const { JSDOM } = require("jsdom");
const https = require("https");
const fs = require("fs");
const path = require("path");

// 配置变量
var problemID , haveJudge = false; // 问题 ID，从命令行参数传入

for(let i = 2; i < process.argv.length; i++) {
    let arg = process.argv[i];
    if(arg[0] != "-") problemID = arg;
    else {
        arg = arg.slice(1);
        if(arg == "j" || arg == "judge") haveJudge = true;
    }
}

const cookieFile = "Cookie.txt"; // 存储 Cookie 的文件
const graderTemplateFile = "grader.cpp"; // Grader 模板文件
const outputFolder = `${problemID}`; // 输出的文件夹路径

// 检查文件是否存在
if (!fs.existsSync(cookieFile)) {
    console.error(`Cookie file not found: ${cookieFile}`);
    process.exit(1);
}
if (!fs.existsSync(graderTemplateFile)) {
    console.error(`Grader template file not found: ${graderTemplateFile}`);
    process.exit(1);
}

// 读取 Cookie 和 Grader 模板
const cookie = fs.readFileSync(cookieFile).toString().trim();
const graderTemplate = fs.readFileSync(graderTemplateFile).toString();

// 创建输出文件夹
fs.mkdirSync(outputFolder, { recursive: true });
fs.mkdirSync(path.join(outputFolder, "data"), { recursive: true });

// HTTPS 请求工具
function httpsRequest(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { headers: { Cookie: cookie } }, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                reject(new Error(`Request failed with status code: ${res.statusCode}`));
                return;
            }
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve(body));
        });
        req.on("error", (err) => reject(err));
        req.end();
    });
}

// 提取问题相关信息
async function fetchProblemInfo() {
    const url = `https://community.topcoder.com/stat?c=problem_statement&pm=${problemID}`;
    console.log(`Fetching problem info from ${url}`);
    const html = await httpsRequest(url);
    const dom = new JSDOM(html);
    const selector =
        "body > table > tbody > tr > td.bodyText > table.paddingTable > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(6) > td > table > tbody > tr:nth-child(5) > td:nth-child(2) > table > tbody > tr > td:nth-child(2)";
    const info = dom.window.document.querySelectorAll(selector);
    if (info.length < 4) {
        throw new Error("Failed to extract problem information. Check the selector.");
    }
    return {
        className: info[0].textContent.trim(),
        methodName: info[1].textContent.trim(),
        parameters: info[2].textContent.trim().split(",").map((param) => param.trim()),
        returnType: info[3].textContent.trim(),
    };
}

const graderFilePath = path.join(outputFolder, "grader.cpp");
const compileFilePath = path.join(outputFolder, "compile.sh");
const judgeFilePath = path.join(outputFolder, "judge.sh");

const compile = fs.readFileSync("compile.sh").toString();
const judge = fs.readFileSync("judge.sh").toString();

// 生成 grader 文件
function generateGraderFile(info) {
    let graderContent = graderTemplate + "\nint main() {\n";
    info.parameters.forEach((param, index) => {
        graderContent += `    auto _${index} = graderIO::read<${param}>();\n`;
    });
    graderContent += `    graderIO::write(${info.className}().${info.methodName}(`;
    graderContent += info.parameters.map((_, index) => `_${index}`).join(", ");
    graderContent += "));\n}";
    fs.writeFileSync(graderFilePath, graderContent);
    console.log(`Grader file generated: ${graderFilePath}`);
}

// 提取测试数据
async function fetchTestData() {
    const url = `https://archive.topcoder.com/ProblemStatement/pm/${problemID}`;
    console.log(`Fetching test data from ${url}`);
    const html = await httpsRequest(url);
    const dom = new JSDOM(html);
    const selector = "body > main > section.__className_c9cbed > article > div:nth-child(5) > ol";
    const list = dom.window.document.querySelector(selector);
    if (!list) {
        throw new Error("Failed to extract test cases. Check the selector.");
    }
    return Array.from(list.querySelectorAll("li")).map((li) => li.textContent.trim());
}

// 处理每个测试用例
function processTestCase(testCase, index) {
    const dataFolder = path.join(outputFolder, "data");
    const inputFilePath = path.join(dataFolder, `${index}.in`);
    const outputFilePath = path.join(dataFolder, `${index}.out`);
    const lines = testCase.split("\n");

    let inputContent = "";
    let outputContent = "";

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith("Returns:")) {
            // 输出部分（Returns 后的内容）
            outputContent = trimmedLine.replace("Returns:", "").trim();
        } else if (trimmedLine.startsWith("{") && trimmedLine.endsWith("}")) {
            // 输入数组部分，去掉多余的空格和逗号
            const formattedLine = trimmedLine
                .replace(/\s*,\s*/g, ",") // 格式化逗号
                .replace(/^\{\s*/, "") // 去掉开头的 {
                .replace(/\s*\}$/, ""); // 去掉结尾的 }
            inputContent += formattedLine.split(",").join(" ") + "\n";
        } else if (trimmedLine) {
            // 普通输入部分
            inputContent += trimmedLine + "\n";
        }
    }

    // 写入输入和输出文件
    fs.writeFileSync(inputFilePath, inputContent.trim());
    fs.writeFileSync(outputFilePath, outputContent.trim());
    console.log(`Processed test case ${index}: ${inputFilePath}, ${outputFilePath}`);
}

// 生成 compile.sh 文件
function generateCompileScript() {
    fs.writeFileSync(compileFilePath, compile);
}

// 生成 judge.sh 文件
function generateJudgeScript(count) {
    fs.writeFileSync(judgeFilePath, `count=${count}\n` + judge);
}

// 主函数
(async function main() {
    try {
        console.log(`Problem ID: ${problemID}`);

        // Step 1: 获取问题的基本信息
        const problemInfo = await fetchProblemInfo();
        console.log("Problem Info:", problemInfo);

        // Step 2: 生成 grader.cpp 文件
        generateGraderFile(problemInfo);

        // Step 3: 获取测试数据
        const testCases = await fetchTestData();
        console.log(`Found ${testCases.length} test cases.`);

        // Step 4: 处理每个测试用例
        testCases.forEach((testCase, index) => processTestCase(testCase, index + 1));

        // Step 5: 生成 compile.sh 文件
        generateCompileScript();

        // Step 6: 生成 judge.sh 文件
        if(haveJudge)
            generateJudgeScript(testCases.length);

        console.log(`All files saved to folder: ${outputFolder}`);
    } catch (error) {
        console.error("An error occurred:", error.message);
    }
})();