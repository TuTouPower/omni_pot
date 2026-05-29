#!/usr/bin/env node
/* global fetch, URLSearchParams, console, process, setTimeout */
/**
 * Test pot-app plugin APIs to check which are free and currently working.
 * Tests translation: EN->ZH ("hello") and ZH->EN ("你好")
 */

const tests = [
    {
        name: "火山翻译 (Volcengine)",
        category: "translate",
        note: "免配置",
        async test(text, from, to) {
            const res = await fetch("https://translate.volcengine.com/crx/translate/v1", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source_language: from, target_language: to, text }),
            });
            const data = await res.json();
            if (data.translation) return { ok: true, result: data.translation };
            return { ok: false, error: JSON.stringify(data) };
        },
    },
    {
        name: "腾讯交互翻译 (Transmart)",
        category: "translate",
        note: "免配置",
        async test(text, from, to) {
            const res = await fetch("https://transmart.qq.com/api/imt", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                    "Referer": "https://transmart.qq.com/zh-CN/index",
                },
                body: JSON.stringify({
                    header: {
                        fn: "auto_translation",
                        client_key: process.env.TRANSMART_CLIENT_KEY || "browser-chrome-120.0.0-Windows-df4bd4c5-a65d-44b2-a40f-42f34f3535f2-1677486696487",
                    },
                    type: "plain",
                    model_category: "normal",
                    source: { lang: from, text_list: [text] },
                    target: { lang: to },
                }),
            });
            const data = await res.json();
            if (data.auto_translation) return { ok: true, result: data.auto_translation.join("\n").trim() };
            return { ok: false, error: JSON.stringify(data) };
        },
    },
    {
        name: "百度翻译 (Baidu - via Hujiang API)",
        category: "translate",
        note: "免配置, 实际用沪江 API",
        async test(text, from, to) {
            const form = new URLSearchParams();
            form.append("content", text);
            const res = await fetch(`http://res.d.hjfile.cn/v10/dict/translation/${from}/${to}`, {
                method: "POST",
                headers: {
                    "Host": "res.d.hjfile.cn",
                    "Origin": "http://res.d.hjfile.cn",
                    "Referer": "http://res.d.hjfile.cn/app/trans",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Cookie": process.env.HUJIANG_COOKIE || "HJ_UID=390f25c7-c9f3-b237-f639-62bd23cd431f; HJC_USRC=uzhi; HJC_NUID=1",
                },
                body: form,
            });
            const data = await res.json();
            if (data.data && data.data.content) return { ok: true, result: data.data.content };
            return { ok: false, error: JSON.stringify(data) };
        },
    },
    {
        name: "有道翻译 (Youdao)",
        category: "translate",
        note: "免配置, 需 MD5 签名 + AES 解密",
        async test(text, from, to) {
            const crypto = await import("node:crypto");

            const mysticTime = Date.now().toString();
            const signStr = `client=fanyideskweb&mysticTime=${mysticTime}&product=webfanyi&key=${process.env.YOUDAO_SIGN_KEY || 'Vy4EQ1uwPkUoqvcP1nIu6WiAjxFeA3Y3'}`;
            const sign = crypto.createHash("md5").update(signStr).digest("hex");

            const form = new URLSearchParams();
            form.append("i", text);
            form.append("from", from);
            form.append("to", to);
            form.append("dictResult", "true");
            form.append("keyid", "webfanyi");
            form.append("sign", sign);
            form.append("client", "fanyideskweb");
            form.append("product", "webfanyi");
            form.append("appVersion", "1.0.0");
            form.append("vendor", "web");
            form.append("pointParam", "client,mysticTime,product");
            form.append("mysticTime", mysticTime);
            form.append("keyfrom", "fanyi.web");

            const res = await fetch("https://dict.youdao.com/webtranslate", {
                method: "POST",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                    "Host": "dict.youdao.com",
                    "Origin": "https://fanyi.youdao.com",
                    "Referer": "https://fanyi.youdao.com/",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Cookie": `OUTFOX_SEARCH_USER_ID=${Math.floor(Math.random() * 100000000)}@127.0.0.1`,
                },
                body: form,
            });
            const rawText = await res.text();

            // AES decrypt
            try {
                const aesKey = process.env.YOUDAO_AES_KEY || "ydsecret://query/key/B*RGygVywfNBwpmBaZg*WT7SIOUP2T0C9WHMZN39j^DAdaZhAnxvGcCY6VYFwnHl";
                const aesIv = process.env.YOUDAO_AES_IV || "ydsecret://query/iv/C@lZe2YzHtZ2CYgaXKSVfsb7Y4QWHjITPPZ0nQp87fBeJ!Iv6v^6fvi2WN@bYpJ4";
                const key = crypto.createHash("md5").update(aesKey).digest();
                const iv = crypto.createHash("md5").update(aesIv).digest();
                const b64 = rawText.replace(/-/g, "+").replace(/_/g, "/");
                const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
                let decrypted = decipher.update(b64, "base64", "utf8");
                decrypted += decipher.final("utf8");
                const json = JSON.parse(decrypted.trim());
                if (json.translateResult) {
                    let target = "";
                    for (const pass of json.translateResult) {
                        for (const line of pass) {
                            target += line.tgt + "\n";
                        }
                    }
                    return { ok: true, result: target.trim() };
                }
                if (json.dictResult && json.dictResult.ec) {
                    const ec = json.dictResult.ec;
                    const parts = [];
                    if (ec.word && ec.word.trs) {
                        for (const tr of ec.word.trs) {
                            parts.push(`${tr.pos || ""} ${tr.tran}`.trim());
                        }
                    }
                    return { ok: true, result: parts.join("; ") || JSON.stringify(ec).slice(0, 200) };
                }
                return { ok: false, error: "Unexpected response: " + JSON.stringify(json).slice(0, 300) };
            } catch (e) {
                return { ok: false, error: `Decrypt failed: ${e.message}, raw: ${rawText.slice(0, 200)}` };
            }
        },
    },
    {
        name: "彩云小译 (Caiyun)",
        category: "translate",
        note: "免配置, 内置 token",
        async test(text, from, to) {
            const langPair = `${from}2${to}`;
            const res = await fetch("https://interpreter.cyapi.cn/v1/translator", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-authorization": `token ${process.env.CAIYUN_TOKEN || 'ssdj273ksdiwi923bsd9'}`,
                    "User-Agent": "caiyunInterpreter/5 CFNetwork/1404.0.5 Darwin/22.3.0",
                },
                body: JSON.stringify({
                    source: text,
                    detect: true,
                    os_type: "ios",
                    device_id: "F1F902F7-1780-4C88-848D-71F35D88A602",
                    trans_type: langPair,
                    media: "text",
                    request_id: Date.now() % 1000000000,
                    user_id: "",
                    dict: true,
                }),
            });
            const data = await res.json();
            if (data.target) return { ok: true, result: data.target };
            return { ok: false, error: JSON.stringify(data) };
        },
    },
    {
        name: "腾讯翻译君 (Tencent WeChat)",
        category: "translate",
        note: "免配置, 模拟微信小程序",
        async test(text, from, to) {
            const params = new URLSearchParams({
                source: "auto",
                target: "auto",
                sourceText: text,
                platform: "WeChat_APP",
                guid: process.env.WECHAT_GUID || "oqdgX0SIwhvM0TmqzTHghWBvfk22",
                candidateLangs: `${from}|${to}`,
            });
            const res = await fetch(`https://wxapp.translator.qq.com/api/translate?${params}`, {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.32(0x18002035) NetType/WIFI Language/zh_TW",
                    "Content-Type": "application/json",
                    "Host": "wxapp.translator.qq.com",
                    "Referer": "https://servicewechat.com/wxb1070eabc6f9107e/117/page-frame.html",
                },
            });
            const data = await res.json();
            if (data.targetText) return { ok: true, result: data.targetText };
            return { ok: false, error: JSON.stringify(data) };
        },
    },
    {
        name: "Papago (Naver)",
        category: "translate",
        note: "免配置, 需动态获取 HMAC token",
        async test(text, from, to) {
            try {
                // Get main page to extract script version
                const mainRes = await fetch("https://papago.naver.com", {
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" },
                });
                const mainHtml = await mainRes.text();
                const scriptMatch = mainHtml.match(/\/main\.([^"]+)/);
                if (!scriptMatch) return { ok: false, error: "Cannot find main script path" };

                const scriptRes = await fetch(`https://papago.naver.com${scriptMatch[0]}`, {
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" },
                });
                const scriptText = await scriptRes.text();
                const versionMatch = scriptText.match(/v1\.([^"]+)/);
                if (!versionMatch) return { ok: false, error: "Cannot find version in script" };
                const version = versionMatch[0];

                const crypto = await import("node:crypto");
                const uuid = crypto.randomUUID();
                const time = Date.now();
                const papagoUrl = "https://papago.naver.com/apis/n2mt/translate";
                const hmacData = `${uuid}\n${papagoUrl}\n${time}`;
                const hash = crypto.createHmac("md5", version).update(hmacData).digest("base64");
                const token = hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

                const form = new URLSearchParams({
                    deviceId: uuid, locale: to, dict: "false", dictDisplay: "30",
                    honorific: "false", instant: "false", paging: "false",
                    source: from, target: to, text, usageAgreed: "false",
                });
                const res = await fetch(papagoUrl, {
                    method: "POST",
                    headers: {
                        "Authorization": `PPG ${uuid}:${token}`,
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "Timestamp": time.toString(),
                        "Device-Type": "pc",
                        "X-Apigw-Partnerid": "papago",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                    },
                    body: form,
                });
                const data = await res.json();
                if (data.translatedText) return { ok: true, result: data.translatedText };
                return { ok: false, error: JSON.stringify(data) };
            } catch (e) {
                return { ok: false, error: e.message };
            }
        },
    },
    {
        name: "Tatoeba (例句查询)",
        category: "dict",
        note: "免配置, 例句搜索引擎",
        async test(text, from, to) {
            const params = new URLSearchParams({
                query: text, from, to, has_audio: "no", sort: "relevance",
            });
            const res = await fetch(`https://tatoeba.org/eng/api_v0/search?${params}`);
            const data = await res.json();
            if (data.results) {
                const sentences = data.results.slice(0, 3).map(r => r.text || JSON.stringify(r).slice(0, 100));
                return { ok: true, result: sentences.join(" | ") || "(no results)" };
            }
            return { ok: false, error: JSON.stringify(data).slice(0, 300) };
        },
    },
    {
        name: "Free Dictionary API (英英词典)",
        category: "dict",
        note: "免费, 无需 key, 仅英文",
        async test(text) {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data[0] && data[0].meanings) {
                    const defs = [];
                    for (const m of data[0].meanings.slice(0, 2)) {
                        for (const d of m.definitions.slice(0, 2)) {
                            defs.push(`(${m.partOfSpeech}) ${d.definition}`);
                        }
                    }
                    return { ok: true, result: defs.join("; ") };
                }
                return { ok: false, error: "Unexpected format: " + JSON.stringify(data).slice(0, 200) };
            }
            const errText = await res.text();
            return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
        },
    },
    {
        name: "LibreTranslate",
        category: "translate",
        note: "需要 API key (libretranslate.com), 但自部署免费",
        async test(text, from, to) {
            const res = await fetch("https://libretranslate.com/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ q: text, source: from, target: to }),
            });
            const data = await res.json();
            if (data.translatedText) return { ok: true, result: data.translatedText };
            return { ok: false, error: JSON.stringify(data) };
        },
    },
    {
        name: "Lingva Translate",
        category: "translate",
        note: "免费开源, Google 翻译前端",
        async test(text, from, to) {
            const res = await fetch(`https://lingva.ml/api/v1/${from}/${to}/${encodeURIComponent(text)}`);
            const text2 = await res.text();
            try {
                const data = JSON.parse(text2);
                if (data.translation) return { ok: true, result: data.translation };
                return { ok: false, error: JSON.stringify(data) };
            } catch {
                return { ok: false, error: `Not JSON (Cloudflare?): ${text2.slice(0, 200)}` };
            }
        },
    },
];

async function run() {
    const testCases = [
        { text: "hello", from: "en", to: "zh", label: "EN→ZH: hello" },
        { text: "你好", from: "zh", to: "en", label: "ZH→EN: 你好" },
    ];

    console.log("=== pot-app Plugin API Test ===\n");

    for (const tc of testCases) {
        console.log(`--- ${tc.label} ---`);
        for (const t of tests) {
            process.stdout.write(`  ${t.name}... `);
            try {
                const result = await Promise.race([
                    t.test(tc.text, tc.from, tc.to),
                    new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout (15s)")), 15000)),
                ]);
                if (result.ok) {
                    console.log(`OK => ${String(result.result).slice(0, 120)}`);
                } else {
                    console.log(`FAIL => ${String(result.error).slice(0, 120)}`);
                }
            } catch (e) {
                console.log(`ERROR => ${e.message}`);
            }
        }
        console.log("");
    }

    console.log("=== Summary ===");
    console.log("Category | Plugin | Key Needed? | Note");
    console.log("---------|--------|-------------|-----");
    for (const t of tests) {
        console.log(`${t.category} | ${t.name} | No | ${t.note}`);
    }
}

run().catch(console.error);
