const { JSDOM } = require("jsdom");
const adm_zip = require("adm-zip");
const https = require("https");
const fs = require("fs");
const cp = require("child_process");
const path = require("path");

var problemID, haveJudge = false, haveZip = false;

for(let i = 2; i < process.argv.length; i++) {
    let arg = process.argv[i];
    if(arg[0] != "-") problemID = arg;
    else {
        arg = arg.slice(1);
        if(arg == "j" || arg == "judge") haveJudge = true;
        if(arg == "z" || arg == "zip") haveJudge = true;
    }
}

process.chdir(__dirname);
const cookie = fs.readFileSync("Cookie.txt").toString().split("; ");
const grader = fs.readFileSync("grader.cpp").toString();
const config = fs.readFileSync("config.yaml").toString();
const compile = fs.readFileSync("compile.sh").toString();
const judge = fs.readFileSync("judge.sh").toString();
fs.mkdirSync(problemID, { recursive: true });
process.chdir(problemID);
fs.mkdir("data", { recursive: true }, err => { if(err) console.error(err); });

function httpsRequest(path) {
    var url = "https://community.topcoder.com" + path;
    return new Promise((resolve, reject) => {
        var req = https.request({
            host: "community.topcoder.com",
            path: path,
            headers: { Cookie: cookie },
            error: err => reject(`request error: ${url}$`),
            timeout: 15000
        }, res => {
            if(res.statusCode < 200 || res.statusCode >= 300) {
                reject(`bad status ${res.statusCode}: ${url}`);
                return;
            }
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => resolve(new JSDOM(body).window.document));
        });
        req.on("error", err => { reject(`${err}: ${url}`); });
        req.on("timeout", () => req.destroy("timeout"));
        req.end();
    });
}

var Class, Method, Parameters, Returns;
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
function makeGraderFile() {
    let body = grader + "int main() {\n";
    Parameters.forEach((v, i) =>
        body += `    auto _${i} = graderIO::read<${new typeInfo(v).toCpp()}>();\n`
    );
    body += `    graderIO::write(${Class}().${Method}(`;
    let isFirst = true;
    for(let i in Parameters) {
        body += isFirst ? `_${i}` : `, _${i}`;
        isFirst = false;
    }
    body += "));\n}"
    fs.writeFile("grader.cpp", body, err => { if(err) console.error(err); });
}
function makeConfigFile(count) {
    let body = config;
    for(let i = 1; i <= count; i++)
        body += `      - input: ${i}.in\n        output: ${i}.out\n`;
    fs.writeFile("config.yaml", body, err => { if(err) console.error(err); });
    if(haveJudge)
        fs.writeFile("judge.sh", `count=${count}\n` + judge, err => {
            if(err) console.error(err);
        });
}
function makeDataFile(data) {
    let body = `${data.length} test cases\n`;
    let raw = `${Parameters.length} `;
    Parameters.push(Returns);
    for(let i of Parameters) {
        let v = new typeInfo(i);
        raw += `${v.type} ${v.count} `;
    }
    raw += data.length + " ";
    data.forEach((v, i) => {
        body += `test #${i + 1}\n`;
        body += v.input.replaceAll("\n", " ") + "\n" + v.output.replaceAll("\n", " ") + "\n";
        raw += parse(v.input) + parse(v.output);
    });
    fs.writeFile("data.txt", body, err => { if(err) console.error(err); });
    fs.writeFile("temp", myTrim(raw), err => {
        if(err) return console.error(err);
        cp.exec(path.join("..", "generator"), (err, stdout, stderr) => {
            if(err) return console.error(err);
            fs.unlink("temp", err => { if(err) console.error(err); });
        });
    });
}
fs.writeFile("compile.sh", compile, err => { if(err) console.log(err); });
httpsRequest("/stat?c=problem_statement&pm=" + problemID).then(doc => {
    let sel = "body > table > tbody > tr > td.bodyText > table.paddingTable > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(6) > td > table > tbody > tr:nth-child(5) > td:nth-child(2) > table > tbody > tr > td:nth-child(2)";
    let info = doc.querySelectorAll(sel);
    Class = info[0].textContent;
    Method = info[1].textContent;
    Parameters = info[2].textContent.split(", ");
    Returns = info[3].textContent;
    makeGraderFile();
    sel = "body > table > tbody > tr > td.bodyText > table.paddingTable > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(10) > td > a";
    return httpsRequest(doc.querySelector(sel).href);
}).then(doc => {
    let sel = "body > table > tbody > tr > td.bodyText > div > table:nth-child(3) > tbody > tr:nth-child(12) > td > a.stattext";
    let info = doc.querySelectorAll(sel);
    if(info.length == 0) throw("no accepted code");
    return httpsRequest(info[info.length - 1].href);
}).then(doc => {
    let sel = "body > table > tbody > tr > td.bodyText > table.paddingTable > tbody > tr:nth-child(1) > td > table > tbody > tr.aligntop";
    let info = doc.querySelectorAll(sel), data = new Array();
    for(let i of info) data.push({
        "input": i.children[1].textContent,
        "output": i.children[3].textContent
    });
    makeConfigFile(data.length), makeDataFile(data);
}).catch(reason => console.error(reason));