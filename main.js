const { JSDOM } = require("jsdom");
const https = require("https");
const fs = require("fs");
const cp = require("child_process");
const path = require("path");
const platform=process.platform

// 配置变量
var problemID, haveJudge = false; // 问题 ID，从命令行参数传入

for (let i = 2; i < process.argv.length; i++) {
    let arg = process.argv[i];
    if (arg[0] != "-") problemID = arg;
    else {
        arg = arg.slice(1);
        if (arg == "j" || arg == "judge") haveJudge = true;
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

// 读取 Cookie 和 Grader 模板
const cookie = fs.readFileSync(cookieFile).toString().trim();
const graderTemplate = fs.readFileSync(graderTemplateFile).toString();

// 创建输出文件夹
fs.mkdirSync(outputFolder, { recursive: true });
fs.mkdirSync(path.join(outputFolder, "data"), { recursive: true });

// HTTPS 请求工具
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'; // 常用的 User-Agent

function httpsRequest(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                Cookie: cookie,
                'User-Agent': userAgent
            }
        }, (res) => {
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
function fetchProblemInfo() {
    const url = `https://community.topcoder.com/stat?c=problem_statement&pm=${problemID}`;
    console.log(`Fetching problem info from ${url}`);
    return httpsRequest(url)
        .then(html => {
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
        });
}

const graderFilePath = path.join(outputFolder, "grader.cpp");
const compileFilePath = path.join(outputFolder, "compile.sh");
const compileCppFilePath = path.join(outputFolder, "compile.cpp");
const judgeFilePath = path.join(outputFolder, "judge.sh");
const judgeCppFilePath = path.join(outputFolder, "judge.cpp");
const tempFilePath = path.join(outputFolder, "temp");

const compile = fs.readFileSync("compile.sh").toString();
const compileCpp = fs.readFileSync("compile.cpp").toString();
const judge = fs.readFileSync("judge.sh").toString();
const judgecpp = fs.readFileSync("judge.cpp").toString();


function typeInfo(s) {
    let len = s.indexOf("[]");
    if(len < 0) len = s.length;
    this.type = s.slice(0, len), this.count = (s.length - len) / 2;
    this.toCpp = () => {
        let type = this.type.toLowerCase();
        if(type == "long") type_cpp = "long long";
        return "std::vector<".repeat(this.count) + type + ">".repeat(this.count);
    }
}
// 生成 grader 文件
function generateGraderFile(info) {
    let graderContent = graderTemplate + "\nint main() {\n";
    if(platform=="win32") graderContent=graderContent+"    _setmode(_fileno(stdin), _O_BINARY);\n";
    info.parameters.forEach((param, index) => {
        graderContent += `    auto _${index} = graderIO::read<${new typeInfo(param).toCpp()}>();\n`;
    });
    graderContent += `    graderIO::write(${info.className}().${info.methodName}(`;
    graderContent += info.parameters.map((_, index) => `_${index}`).join(", ");
    graderContent += `));\n    return 0;\n}`;
    fs.writeFileSync(graderFilePath, graderContent);
    console.log(`Grader file generated: ${graderFilePath}`);
}

// 提取测试数据
function fetchTestData() {
    const url = `https://archive.topcoder.com/ProblemStatement/pm/${problemID}`;
    console.log(`Fetching test data from ${url}`);
    return httpsRequest(url)
        .then(html => {
            const dom = new JSDOM(html);
            const selector1 = "body > main > section.__className_c9cbed > article";
            const list1 = dom.window.document.querySelector(selector1)
            const len = list1.childElementCount;
            const selector = "body > main > section.__className_c9cbed > article > div:nth-child(" + len + ") > ol";
            const list = dom.window.document.querySelector(selector);
            if (!list) {
                throw new Error("Failed to extract test cases. Check the selector.");
            }
            return Array.from(list.querySelectorAll("li")).map((li) => li.textContent.trim());
        });
}

// 处理每个测试用例
function processTestCase(testCase) {
    const dataFolder = path.join(outputFolder, "data");
    const lines = testCase.split("\n");

    let inputContent = "";
    let outputContent = "";

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith("Returns:")) {
            // 输出部分（Returns 后的内容）
            outputContent = trimmedLine.replace("Returns:", "").trim();
            break;
        } else if (trimmedLine) {
            // 普通输入部分
            inputContent += trimmedLine + "\n";
        }
    }

    return {
        "input": inputContent,
        "output": outputContent,
    }
}

function parse(s) {
    let res = "", inq = false;
    for(let c of s) {
        if(c == "\"") inq = !inq;
        if(inq) res += c;
        else if(c == "{") res += " { ";
        else if(c == "}") res += " } ";
        else res += c == "," || c == "\n" ? " " : c;
    }
    return res + " ";
}
function myTrim(s) {
    let res = "", inq = false, lst = " ";
    for(let c of s) {
        if(c == "\"") inq = !inq;
        if(inq) res += c;
        else if(c != " " || lst != " ") res += c;
        lst = c;
    }
    return res;
}
function makeDataFile(data,info) {
    let parameters=info.parameters
    let raw = `${parameters.length} `;
    parameters.push(info.returnType);
    for(let i of parameters) {
        let v = new typeInfo(i);
        raw += `${v.type} ${v.count} `;
    }
    raw += data.length + " ";
    data.forEach((v, i) => {
        raw += parse(v.input) + parse(v.output);
    });
    fs.writeFile(tempFilePath, myTrim(raw), err => {
        if(err) return console.error(err);
        let cmd=`generator ${problemID}`;
        if(platform!="win32") cmd="./"+cmd;
        cp.exec((cmd), (err, stdout, stderr) => {
            if(err) return console.error(err);
            fs.unlink(tempFilePath, err => { if(err) console.error(err); });
        });
    });
}

// 生成 compile.sh 文件
function generateCompileScript() {
    fs.writeFileSync(compileFilePath, compile);
    fs.writeFileSync(compileCppFilePath, compileCpp);
}

// 生成 judge.sh 文件
function generateJudgeScript(count) {
    fs.writeFileSync(judgeFilePath, `count=${count}\n` + judge);
    fs.writeFileSync(judgeCppFilePath, `const int count=${count};\n` + judgecpp);
}

// 主函数
function main() {
    console.log(`Problem ID: ${problemID}`);

    // Step 1: 获取问题的基本信息
    fetchProblemInfo()
        .then(problemInfo => {
            console.log("Problem Info:", problemInfo);

            // Step 2: 生成 grader.cpp 文件
            generateGraderFile(problemInfo);

            // Step 3: 获取测试数据
            return fetchTestData()
            .then(testCases => {
                console.log(`Found ${testCases.length} test cases.`);

                // Step 4: 处理每个测试用例
                let data=new Array();
                testCases.forEach((testCase, index) => data.push(processTestCase(testCase)));
                makeDataFile(data,problemInfo)

                // Step 5: 生成 compile.sh 文件
                generateCompileScript();

                // Step 6: 生成 judge.sh 文件
                if (haveJudge)
                    generateJudgeScript(testCases.length);

                console.log(`All files saved to folder: ${outputFolder}`);
            })
    })
    .catch(error => {
        console.error("An error occurred:", error.message);
    });
}

main();