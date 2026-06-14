/* ============================================================
   Omni Pot — site chrome: theme + language toggles + i18n
   Loaded at end of <body> on every page. Pairs with the tiny
   inline head snippet that applies theme/lang before first paint.
   ============================================================ */
(function () {
  "use strict";

  var LS_THEME = "op-theme"; // system | light | dark
  var LS_LANG = "op-lang";   // zh | en
  var mq = window.matchMedia("(prefers-color-scheme: dark)");

  /* ---------- state ---------- */
  function getTheme() {
    var t = localStorage.getItem(LS_THEME);
    return t === "light" || t === "dark" || t === "system" ? t : "system";
  }
  function getLang() {
    var l = localStorage.getItem(LS_LANG);
    if (l === "zh" || l === "en") return l;
    return (navigator.language || "").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  }
  function resolvedDark(theme) {
    return theme === "dark" || (theme === "system" && mq.matches);
  }
  function applyTheme(theme) {
    document.documentElement.classList.toggle("dark", resolvedDark(theme));
  }

  /* ---------- i18n: shared chrome dictionary (zh -> en) ---------- */
  var CHROME = {
    "功能": "Features",
    "平台": "Platforms",
    "定价": "Pricing",
    "下载": "Download",
    "去爱发电支持作者": "Support me on Afdian",
    "法律条款 · Legal": "Legal",
    "目录": "Contents",
    "服务条款": "Terms of Service",
    "隐私政策": "Privacy Policy",
    "退款政策": "Refund Policy",
    "生效日期": "Effective date",
    "产品": "Product",
    "网站": "Website",
    "运营者": "Operator",
    "支持": "Support",
    "隐私联系": "Privacy contact"
  };
  var TITLES = {
    "Omni Pot · 定价": "Omni Pot · Pricing",
    "Omni Pot · 跨平台桌面翻译与识别工具": "Omni Pot · Cross-platform desktop translation & OCR",
    "Omni Pot · 退款政策": "Omni Pot · Refund Policy",
    "Omni Pot · 服务条款": "Omni Pot · Terms of Service",
    "Omni Pot · 隐私政策": "Omni Pot · Privacy Policy"
  };

  /* selectors whose trailing text node is a chrome string */
  var CHROME_SEL =
    ".nav-links a, .nav-right .btn-cta.primary, .foot-inner a, " +
    ".legal-crosslinks a, .toc .toc-label, .legal-head .eyebrow, .legal-intro dt";

  var origTrailing = new WeakMap(); // el -> original trailing text
  var origHTML = new WeakMap();     // el -> original innerHTML (for data-en)
  var origCopy = null;              // footer copy original innerHTML
  var origTitle = null;
  var origLegalH1 = null;

  function trailingTextNode(el) {
    var n = el.childNodes;
    for (var i = n.length - 1; i >= 0; i--) {
      if (n[i].nodeType === 3 && n[i].textContent.trim()) return n[i];
    }
    return null;
  }

  function applyLang(lang) {
    var en = lang === "en";
    document.documentElement.lang = en ? "en" : "zh-CN";
    document.documentElement.dataset.opLang = lang;

    /* page title */
    if (origTitle === null) origTitle = document.title;
    if (en && TITLES[origTitle]) document.title = TITLES[origTitle];
    else document.title = origTitle;

    /* chrome strings via trailing text node */
    document.querySelectorAll(CHROME_SEL).forEach(function (el) {
      var node = trailingTextNode(el);
      if (!node) return;
      if (!origTrailing.has(el)) origTrailing.set(el, node.textContent);
      var orig = origTrailing.get(el);
      var key = orig.trim();
      if (en && CHROME[key] != null) {
        node.textContent = orig.replace(key, CHROME[key]);
      } else {
        node.textContent = orig;
      }
    });

    /* afdian aria-label */
    document.querySelectorAll(".afdian[aria-label]").forEach(function (el) {
      el.setAttribute("aria-label", en ? "Support me on Afdian" : "去爱发电支持作者");
    });

    /* footer copy (has <b> child) */
    var copy = document.querySelector(".foot-inner .copy");
    if (copy) {
      if (origCopy === null) origCopy = copy.innerHTML;
      copy.innerHTML = en
        ? '© 2026 <b>Omni Pot</b> · All rights reserved'
        : origCopy;
    }

    /* legal head <h1>: "中文 / English" -> "English" in EN mode */
    var lh1 = document.querySelector(".legal-head h1");
    if (lh1) {
      if (origLegalH1 === null) origLegalH1 = lh1.innerHTML;
      var enSpan = lh1.querySelector(".en");
      var enTitle = enSpan ? enSpan.textContent.replace(/^\s*\/\s*/, "").trim() : "";
      lh1.innerHTML = en && enTitle ? enTitle : origLegalH1;
    }

    /* page-body content via data-en (full innerHTML swap) */
    document.querySelectorAll("[data-en]").forEach(function (el) {
      if (!origHTML.has(el)) origHTML.set(el, el.innerHTML);
      el.innerHTML = en ? el.getAttribute("data-en") : origHTML.get(el);
    });

    /* refresh control labels + states */
    syncControls(lang, getTheme());
    document.dispatchEvent(new CustomEvent("op:langchange", { detail: { lang: lang } }));
  }

  /* ---------- icons ---------- */
  function svg(paths) {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + "</svg>";
  }
  var ICON = {
    system: svg('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'),
    light: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>'),
    dark: svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
    check: '<svg class="op-chk" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  };

  /* ---------- build controls ---------- */
  var els = {};
  function buildControls() {
    var host = document.querySelector(".nav-right");
    if (!host) return;

    var ctl = document.createElement("div");
    ctl.className = "op-ctl";
    ctl.innerHTML =
      '<div class="op-lang" role="group" aria-label="Language">' +
        '<button type="button" data-lang="zh">中</button>' +
        '<button type="button" data-lang="en">EN</button>' +
      '</div>' +
      '<div class="op-theme-wrap">' +
        '<button type="button" class="op-theme-btn" aria-haspopup="menu" aria-expanded="false"></button>' +
        '<div class="op-theme-menu" role="menu" hidden>' +
          '<button type="button" role="menuitemradio" data-theme="system">' + ICON.system + '<span class="op-mt-label"></span>' + ICON.check + '</button>' +
          '<button type="button" role="menuitemradio" data-theme="light">' + ICON.light + '<span class="op-mt-label"></span>' + ICON.check + '</button>' +
          '<button type="button" role="menuitemradio" data-theme="dark">' + ICON.dark + '<span class="op-mt-label"></span>' + ICON.check + '</button>' +
        '</div>' +
      '</div>';

    host.insertBefore(ctl, host.firstChild);

    els.langBtns = ctl.querySelectorAll(".op-lang button");
    els.themeBtn = ctl.querySelector(".op-theme-btn");
    els.themeMenu = ctl.querySelector(".op-theme-menu");
    els.themeItems = ctl.querySelectorAll(".op-theme-menu button");

    els.langBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        var l = b.dataset.lang;
        localStorage.setItem(LS_LANG, l);
        applyLang(l);
      });
    });

    els.themeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleMenu();
    });
    els.themeItems.forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.dataset.theme;
        localStorage.setItem(LS_THEME, t);
        applyTheme(t);
        syncControls(getLang(), t);
        toggleMenu(false);
      });
    });
    document.addEventListener("click", function () { toggleMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") toggleMenu(false);
    });
  }

  function toggleMenu(force) {
    var open = force != null ? force : els.themeMenu.hasAttribute("hidden");
    if (open) els.themeMenu.removeAttribute("hidden");
    else els.themeMenu.setAttribute("hidden", "");
    els.themeBtn.setAttribute("aria-expanded", String(open));
  }

  function syncControls(lang, theme) {
    if (!els.themeBtn) return;
    var en = lang === "en";
    var labels = en
      ? { system: "System", light: "Light", dark: "Dark" }
      : { system: "跟随系统", light: "浅色", dark: "深色" };

    els.langBtns.forEach(function (b) {
      b.classList.toggle("active", b.dataset.lang === lang);
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });

    els.themeBtn.innerHTML = ICON[theme];
    els.themeBtn.setAttribute("aria-label", en ? "Theme: " + labels[theme] : "主题：" + labels[theme]);
    els.themeBtn.setAttribute("title", en ? "Theme" : "主题");

    els.themeItems.forEach(function (b) {
      var t = b.dataset.theme;
      b.querySelector(".op-mt-label").textContent = labels[t];
      b.classList.toggle("active", t === theme);
      b.setAttribute("aria-checked", String(t === theme));
    });
  }

  /* ---------- styles ---------- */
  function injectCSS() {
    var css =
      ".op-ctl{display:inline-flex;align-items:center;gap:8px;margin-right:2px;}" +
      ".op-lang{display:inline-flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--line);border-radius:8px;background:var(--surface);}" +
      ".op-lang button{height:24px;min-width:30px;padding:0 8px;border-radius:6px;font-family:var(--font-mono);font-size:12px;font-weight:500;letter-spacing:.01em;color:var(--text-mute);transition:background .12s,color .12s;}" +
      ".op-lang button:hover{color:var(--text);}" +
      ".op-lang button.active{background:var(--text);color:var(--bg);}" +
      ".op-theme-wrap{position:relative;display:inline-flex;}" +
      ".op-theme-btn{width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text-dim);transition:background .12s,color .12s,border-color .12s;}" +
      ".op-theme-btn:hover{color:var(--text);border-color:var(--line-strong);}" +
      ".op-theme-menu{position:absolute;top:calc(100% + 8px);right:0;min-width:168px;padding:5px;background:var(--bg-elev);border:1px solid var(--line);border-radius:11px;box-shadow:0 12px 30px -10px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.08);z-index:80;display:flex;flex-direction:column;gap:2px;}" +
      ".op-theme-menu[hidden]{display:none;}" +
      ".op-theme-menu button{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border-radius:7px;font-size:13px;color:var(--text-dim);text-align:left;transition:background .12s,color .12s;}" +
      ".op-theme-menu button .op-mt-label{flex:1;}" +
      ".op-theme-menu button:hover{background:var(--hover);color:var(--text);}" +
      ".op-theme-menu button.active{color:var(--text);}" +
      ".op-theme-menu button .op-chk{opacity:0;color:var(--brand-primary);flex:0 0 auto;}" +
      ".op-theme-menu button.active .op-chk{opacity:1;}" +
      "@media (max-width:600px){.op-ctl{gap:6px;}}";
    var s = document.createElement("style");
    s.id = "op-chrome-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- init ---------- */
  function init() {
    injectCSS();
    buildControls();
    applyTheme(getTheme());
    applyLang(getLang());
    mq.addEventListener("change", function () {
      if (getTheme() === "system") applyTheme("system");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* expose for page scripts */
  window.OPChrome = { getLang: getLang, getTheme: getTheme };
})();
