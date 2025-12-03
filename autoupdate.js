"ui";

var storage = storages.create("autoupdate");
const LOCAL_SCRIPT_PATH = "/sdcard/脚本/taojinbi.js";

// ---------- 解析本地脚本（前3行） ----------
function readLocalFileInfo() {
    var result = { url: "", ver: "" };
    try {
        if (!files.exists(LOCAL_SCRIPT_PATH)) return result;
        var content = files.read(LOCAL_SCRIPT_PATH);
        if (!content) return result;
        var lines = content.split("\n");
        for (var i = 0; i < 3 && i < lines.length; i++) {
            var line = lines[i].trim();
            // 匹配 var taojinbi_source = "http://.../taojinbi.js";
            var m1 = line.match(/var\s+taojinbi_source\s*=\s*["'](.+?)["']/i);
            if (m1) result.url = m1[1];
            // 匹配 var taojinbi_version = "v9.18";
            var m2 = line.match(/var\s+taojinbi_version\s*=\s*["'](.+?)["']/i);
            if (m2) result.ver = m2[1];
        }
    } catch (e) {
        // ignore
    }
    return result;
}

// ---------- 辅助：推导 server-version.txt ----------
function getServerVersionURL(jsURL) {
    if (!jsURL) return "";
    return jsURL.replace(/taojinbi\.js$/i, "server-version.txt");
}

// ---------- 版本比较：返回 true 如果 server > local ----------
function compareVersionIsNew(local, server) {
    if (!server) return false;
    if (!local) return true;
    local = local.replace(/^v/i, "");
    server = server.replace(/^v/i, "");
    var a = local.split(".").map(function (s) { return Number(s) || 0; });
    var b = server.split(".").map(function (s) { return Number(s) || 0; });
    var n = Math.max(a.length, b.length);
    for (var i = 0; i < n; i++) {
        var x = a[i] || 0;
        var y = b[i] || 0;
        if (y > x) return true;
        if (y < x) return false;
    }
    return false;
}

// ---------- 下载脚本并写入，下载完成后刷新 UI ----------
function downloadScriptAndRefresh(url, serverVer) {
    toast("开始下载脚本...");
    ui.ipt_local_ver.setText("---");
    threads.start(function () {
        try {
            var res = http.get(url, { timeout: 15000, rejectUnauthorized: false });
            if (!res || res.statusCode !== 200) {
                toast("下载失败: " + (res ? res.statusCode : "无响应"));
                return;
            }
            var txt = res.body.string();
            files.ensureDir("/sdcard/脚本");
            files.write(LOCAL_SCRIPT_PATH, txt);
            toast("下载并保存完成: " + (serverVer || ""));

            // 重新读取本地版本号（不更新下载地址）
            var info = readLocalFileInfo();
            ui.run(function () {
                // ❗ 保持原下载地址，不更新
                // ui.ipt_url.setText(info.url || "");

                // ✔ 更新本地版本号显示
                ui.ipt_local_ver.setText(info.ver || "");
            });

            // 重新获取服务器版本
            if (url) fetchAndShowServerVersion(url);

        } catch (e) {
            toast("下载出错: " + e);
        }
    });
}


// ---------- 从 server-version.txt 获取服务器版本并显示 ----------
function fetchAndShowServerVersion(jsUrl) {
    var verUrl = getServerVersionURL(jsUrl);
    if (!verUrl) {
        ui.run(function () { ui.ipt_server_ver.setText(""); });
        return;
    }
    threads.start(function () {
        try {
            var r = http.get(verUrl, { timeout: 8000, rejectUnauthorized: false });
            if (r && r.statusCode === 200) {
                var sver = r.body.string().trim();
                ui.run(function () { ui.ipt_server_ver.setText(sver); });
            } else {
                ui.run(function () { ui.ipt_server_ver.setText(""); });
            }
        } catch (e) {
            ui.run(function () { ui.ipt_server_ver.setText(""); });
        }
    });
}

// ---------- UI 布局 ----------
ui.layout(
    <vertical padding="16">
        <text text="自动更新面板" textSize="20sp" gravity="center"/>
        <text text="下载地址：" textSize="16sp" marginTop="12"/>
        <input id="ipt_url" textSize="16sp" hint="http(s)://.../taojinbi.js"/>
        <text text="本地版本：" textSize="16sp" marginTop="12"/>
        <input id="ipt_local_ver" textSize="16sp" enabled="false"/>
        <text text="服务器版本：" textSize="16sp" marginTop="12"/>
        <input id="ipt_server_ver" textSize="16sp" enabled="false"/>
        <horizontal marginTop="12" gravity="center_vertical">
            <checkbox id="chk_force" text="强制更新" textSize="16sp"/>
        </horizontal>
        <horizontal marginTop="20">
            <button id="btn_update" text="执行" w="0" layout_weight="1" textSize="16sp"/>
            <button id="btn_exit" text="退出" w="0" layout_weight="1" marginLeft="12" textSize="16sp"/>
        </horizontal>
    </vertical>
);
ui.post(function () {
    //ui.ipt_local_ver.setEnabled(false);
    ui.ipt_local_ver.setFocusable(false);
    //ui.ipt_local_ver.setCursorVisible(false);

    //ui.ipt_server_ver.setEnabled(false);
    ui.ipt_server_ver.setFocusable(false);
    //ui.ipt_server_ver.setCursorVisible(false);
});
// ---------- 初始化数据加载（storage 优先） ----------
(function init() {
    // 1) 从 storage 读取保存的下载地址
    var saved = storage.get("download_url", "");
    var info = readLocalFileInfo();
    // 2) finalUrl = storage > script > ""
    var finalUrl = saved || (info ? info.url : "") || "";
    var finalLocalVer = (info && info.ver) ? info.ver : "";

    ui.ipt_url.setText(finalUrl);
    ui.ipt_local_ver.setText(finalLocalVer);

    if (finalUrl) {
        fetchAndShowServerVersion(finalUrl);
    } else {
        ui.ipt_server_ver.setText("");
    }
})();

// ---------- 按钮事件 ----------

// 执行：先确保有 URL，再决定是否下载
ui.btn_update.click(function () {
    var url = ui.ipt_url.getText().toString().trim();
    var force = ui.chk_force.isChecked();
    var localVer = ui.ipt_local_ver.getText().toString().trim();

    if (!url || !/^https?:\/\//i.test(url)) {
        toast("请先填有效的下载地址（http/https）");
        return;
    }

    // 先获取服务器版本（如果能取到），再按逻辑决定
    threads.start(function () {
        var serverVer = "";
        try {
            var verUrl = getServerVersionURL(url);
            if (verUrl) {
                var r = http.get(verUrl, { timeout: 8000, rejectUnauthorized: false });
                if (r && r.statusCode === 200) serverVer = r.body.string().trim();
            }
        } catch (e) {
            // 忽略，serverVer 仍可能为空
        }
        ui.run(function () { ui.ipt_server_ver.setText(serverVer); });

        if (force) {
            toast("强制更新：开始下载");
            downloadScriptAndRefresh(url, serverVer);
            return;
        }

        if (!serverVer) {
            // 没拿到服务器版本，只能询问是否直接下载或拒绝。这里默认尝试下载并提示（可改）
            toast("未能获取服务器版本，尝试下载...");
            downloadScriptAndRefresh(url, serverVer);
            return;
        }

        if (compareVersionIsNew(localVer, serverVer)) {
            toast("检测到新版本 " + serverVer + "，开始下载");
            downloadScriptAndRefresh(url, serverVer);
        } else {
            toast("当前已是最新版本：" + localVer);
        }
    });
});

// 退出：保存下载地址到 storage 后退出
ui.btn_exit.click(function () {
    var url = ui.ipt_url.getText().toString().trim();
    storage.put("download_url", url);
    toast("下载地址已保存到 storage，退出");
    exit();
});
