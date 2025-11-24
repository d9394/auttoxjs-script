"ui";

const fs = files;
const LOCAL_SCRIPT_PATH = "/sdcard/脚本/taojinbi.js";

// 解析本地脚本，获得 URL & 本地版本号
function readLocalScriptInfo() {
    if (!fs.exists(LOCAL_SCRIPT_PATH)) return null;

    let lines = fs.read(LOCAL_SCRIPT_PATH).split("\n");

    let url = "";
    let ver = "";

    for (let i = 0; i < 3 && i < lines.length; i++) {
        let line = lines[i].trim();

        if (line.startsWith("var taojinbi_source")) {
            let m = line.match(/"(.*?)"/);
            if (m) url = m[1];
        }

        if (line.startsWith("var taojinbi_version")) {
            let m = line.match(/"(.*?)"/);
            if (m) ver = m[1];
        }
    }

    return { url, ver };
}

// 从 URL 替换得到 server-version.txt 地址
function getServerVersionURL(jsURL) {
    return jsURL.replace("taojinbi.js", "server-version.txt");
}

// 版本比较（主版本.小版本）
function versionIsNew(local, server) {
    if (!local || !server) return false;

    let a = local.replace("v", "").split(".").map(Number);
    let b = server.replace("v", "").split(".").map(Number);

    let majorA = a[0] || 0, minorA = a[1] || 0;
    let majorB = b[0] || 0, minorB = b[1] || 0;

    if (majorB > majorA) return true;
    if (majorB < majorA) return false;

    return minorB > minorA;
}

// 下载脚本
function downloadScript(url, newVer) {
    toast("正在下载脚本……");

    http.get(url, {
        timeout: 8000,
        rejectUnauthorized: false   // 忽略 https 证书错误
    }, function (res) {
        if (!res || res.statusCode !== 200) {
            toast("下载失败");
            return;
        }

        fs.write(LOCAL_SCRIPT_PATH, res.body.string());
        toast("下载完成，版本：" + newVer);

        // ★★ 下载完成后重新读取本地文件并更新 UI ★★
        let info = readLocalScriptInfo();
        if (info) {
            ui.run(function () {
                ui.ipt_url.setText(info.url);
                ui.ipt_local_ver.setText(info.ver);
            });
        }
    });
}

// ---------------- UI ----------------
ui.layout(
    <vertical padding="16">
        <scroll>
            <vertical>
                <text text="服务器下载链接：" textSize="16sp"/>
                <input id="ipt_url" textSize="16sp"/>

                <text text="本地版本号：" textSize="16sp" marginTop="12"/>
                <input id="ipt_local_ver" textSize="16sp"/>

                <text text="服务器版本号：" textSize="16sp" marginTop="12"/>
                <input id="ipt_server_ver" textSize="16sp" enabled="false"/>

                <checkbox id="ck_force" text="强制更新" marginTop="16"/>
            </vertical>
        </scroll>

        <horizontal marginTop="20">
            <button id="btn_run" text="执行" w="0" layout_weight="1"/>
            <button id="btn_exit" text="退出" w="0" layout_weight="1" marginLeft="12"/>
        </horizontal>
    </vertical>
);

// 初始化 UI
let info = readLocalScriptInfo();
if (info) {
    ui.ipt_url.setText(info.url);
    ui.ipt_local_ver.setText(info.ver);

    // 获取服务器版本号
    let verURL = getServerVersionURL(info.url);

    http.get(verURL, {
        timeout: 5000,
        rejectUnauthorized: false
    }, function (res) {
        if (res && res.statusCode === 200) {
            let serverVer = res.body.string().trim();
            ui.run(() => ui.ipt_server_ver.setText(serverVer));
        } else {
            toast("读取服务器版本失败");
        }
    });
} else {
    toast("本地脚本不存在，无法初始化 UI");
}

// ---------------- 按钮事件 ----------------

// 执行更新判断
ui.btn_run.click(function () {
    let url = ui.ipt_url.text();
    let localVer = ui.ipt_local_ver.text().trim();
    let serverVer = ui.ipt_server_ver.text().trim();
    let force = ui.ck_force.checked;

    if (!url || !localVer || !serverVer) {
        toast("信息不完整");
        return;
    }

    if (force) {
        toast("强制更新已启用");
        downloadScript(url, serverVer);
        return;
    }

    if (versionIsNew(localVer, serverVer)) {
        toast("发现新版本：" + serverVer);
        downloadScript(url, serverVer);
    } else {
        toast("当前为最新版本，无需更新");
    }
});

// 退出
ui.btn_exit.click(function () {
    toast("退出程序");
    exit();
});
