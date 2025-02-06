// 导入模块
"ui";
const fs = files;
//const http = require("http");

// 本地文件路径
const LOCAL_VERSION_PATH = "/sdcard/脚本/version.txt";
const LOCAL_SCRIPT_PATH = "/sdcard/脚本/taojinbi.js";

// 远程文件 URL
const SERVER_VERSION_URL = "http://192.168.1.1/server-version.txt";
const SERVER_SCRIPT_URL = "http://192.168.1.1/taojinbi.js";

//序列化数据到本地
//var storage = storages.create("d9394");

// 启动逻辑
function main() {
    let localVersion = "0.1"; // 默认本地版本为0.1

    // 检查本地版本文件
    if (fs.exists(LOCAL_VERSION_PATH)) {
        localVersion = fs.read(LOCAL_VERSION_PATH).trim(); // 读取本地版本号
        console.log("本地版本:", localVersion);
    } else {
        console.log("本地版本文件不存在");
    }

    // 检查远程版本
    console.log("检查远程版本...");
    http.get(SERVER_VERSION_URL, {}, function (res) {
        if (res.statusCode === 200) {
            let serverVersion = res.body.string().trim();
            console.log("远程版本:", serverVersion);

            if (compareVersion(localVersion, serverVersion)) {
                console.log("发现新版本，开始下载...");
                downloadAndSaveScript(serverVersion);
            } else {
                console.log("本地版本已是最新，无需更新");
            }
        } else {
            console.error("获取远程版本失败，状态码:", res.statusCode);
        }
    });

    // 检查本地脚本
    if (fs.exists(LOCAL_SCRIPT_PATH)) {
        console.log("本地脚本存在，尝试加载...");
        try {
            engines.execScriptFile(LOCAL_SCRIPT_PATH); // 加载本地脚本
            console.log("本地脚本加载完成");
        } catch (e) {
            console.error("加载本地脚本失败:", e);
        }
    } else {
        console.log("本地脚本不存在");
    }
}

// 比较版本号 (返回 true 表示远程版本较新)
function compareVersion(local, server) {
    return local < server;
}

// 下载远程脚本并保存
function downloadAndSaveScript(newVersion) {
    http.get(SERVER_SCRIPT_URL, {}, function (res) {
        if (res.statusCode === 200) {
            let scriptContent = res.body.string();
            fs.write(LOCAL_SCRIPT_PATH, scriptContent); // 保存脚本到本地
            fs.write(LOCAL_VERSION_PATH, newVersion); // 更新版本号到本地
            console.log("新版本脚本下载完成，已保存到本地");
            //storage.remove("list_ck")
            //storage.remove("list_txt")
            //console.log("已清空本地关键字");
            exit(); // 下载完成后退出
        } else {
            console.error("下载远程脚本失败，状态码:", res.statusCode);
        }
    });
}

// 启动主逻辑
main();
exit();
