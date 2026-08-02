/* ============================================
   主入口 — DOM 引用、状态、事件、初始化
   ============================================ */

import {
  MODES, CHAR_FIELDS, COLOR_FIELDS, ULT_QUOTES,
} from "./constants.js";
import { makeLabeled, createNumberInput } from "./utils.js";
import {
  dom, state, fontsReadyPromise,
  renderPreview, loadFonts, autoFitChar, autoFitAll,
  download, downloadH, downloadSvg, downloadSvgH,
} from "./renderer.js";

/* === 动态生成汉字字段（结构对齐英文行 .en-line） === */
function generateCharFields() {
  const container = document.getElementById("charFields");
  CHAR_FIELDS.forEach(function (cfg, i) {
    const n = i + 1;
    const field = document.createElement("div");
    field.className = "cn-char-field";

    // 第一行：汉字 + 字号（结构对齐 .en-line + .en-line-input + .en-line-opts）
    const charRow = document.createElement("div");
    charRow.className = "cn-char";

    const charInput = document.createElement("input");
    charInput.type = "text";
    charInput.className = "cn-char-input";
    charInput.id = "char" + n;
    charInput.maxLength = 1;
    charInput.value = cfg.char;

    const charLabel = document.createElement("span");
    charLabel.className = "cn-char-label";
    charLabel.textContent = cfg.label;
    charRow.appendChild(charLabel);
    charRow.appendChild(charInput);

    const charOpts = document.createElement("div");
    charOpts.className = "cn-char-opts";
    charOpts.appendChild(makeLabeled("字号", createNumberInput({
      className: "cn-char-size", id: "size" + n, min: 10, max: 500, step: 5,
      value: cfg.size, title: "字号（占格子的百分比）",
    })));
    charRow.appendChild(charOpts);
    field.appendChild(charRow);

    // 第二行：横坐标 + 纵坐标
    const posRow = document.createElement("div");
    posRow.className = "cn-char-pos";
    posRow.appendChild(makeLabeled("横坐标偏移", createNumberInput({
      className: "cn-char-x", id: "x" + n, min: -500, max: 500, step: 1,
      value: cfg.x, title: "横坐标偏移（像素）",
    })));
    posRow.appendChild(makeLabeled("纵坐标偏移", createNumberInput({
      className: "cn-char-y", id: "y" + n, min: -500, max: 500, step: 1,
      value: cfg.y, title: "纵坐标偏移（像素）",
    })));
    field.appendChild(posRow);

    container.appendChild(field);
  });
}

/* === 动态生成颜色选择器 === */
function generateColorFields() {
  const container = document.getElementById("colorFields");
  COLOR_FIELDS.forEach(function (cfg) {
    const labeled = document.createElement("div");
    labeled.className = "labeled";

    const lbl = document.createElement("span");
    lbl.className = "mini-label";
    lbl.textContent = cfg.label;
    labeled.appendChild(lbl);

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.id = cfg.id;
    colorInput.value = cfg.value;
    colorInput.className = "color-input";
    labeled.appendChild(colorInput);

    const alphaInput = document.createElement("input");
    alphaInput.type = "range";
    alphaInput.id = cfg.id + "Alpha";
    alphaInput.min = 0;
    alphaInput.max = 100;
    alphaInput.value = 100;
    alphaInput.className = "alpha-slider";
    alphaInput.title = "透明度";
    labeled.appendChild(alphaInput);

    container.appendChild(labeled);
  });
}

/* === 填充 DOM 引用（renderer 共享） === */
function populateDomRefs() {
  // 汉字字段（由 JS 动态生成，此时已存在）
  dom.char1 = document.getElementById("char1");
  dom.char2 = document.getElementById("char2");
  dom.char3 = document.getElementById("char3");
  dom.size1 = document.getElementById("size1");
  dom.size2 = document.getElementById("size2");
  dom.size3 = document.getElementById("size3");
  dom.x1 = document.getElementById("x1");
  dom.y1 = document.getElementById("y1");
  dom.x2 = document.getElementById("x2");
  dom.y2 = document.getElementById("y2");
  dom.x3 = document.getElementById("x3");
  dom.y3 = document.getElementById("y3");

  // 中文整体
  dom.cnGlobalSize = document.getElementById("cnGlobalSize");
  dom.cnGlobalX = document.getElementById("cnGlobalX");
  dom.cnGlobalY = document.getElementById("cnGlobalY");

  // 英文
  dom.enLineList = document.getElementById("enLineList");
  dom.enGlobalSize = document.getElementById("enGlobalSize");
  dom.enGlobalX = document.getElementById("enGlobalX");
  dom.enGlobalY = document.getElementById("enGlobalY");
  dom.enLineSpacing = document.getElementById("enLineSpacing");
  dom.enAutoAlign = document.getElementById("enAutoAlign");

  // 输出
  dom.sizeInput = document.getElementById("sizeInput");
  dom.sizeInputH = document.getElementById("sizeInputH");
  dom.canvas = document.getElementById("preview");
  dom.ctx = dom.canvas.getContext("2d");
  dom.canvasH = document.getElementById("previewH");
  dom.ctxH = dom.canvasH.getContext("2d");

  // 自定义面板
  dom.customImageEnabled = document.getElementById("customImageEnabled");
  dom.color1 = document.getElementById("color1");
  dom.color2 = document.getElementById("color2");
  dom.color3 = document.getElementById("color3");
  dom.bgColor = document.getElementById("bgColor");
  dom.blockColor = document.getElementById("blockColor");
  dom.color1Alpha = document.getElementById("color1Alpha");
  dom.color2Alpha = document.getElementById("color2Alpha");
  dom.color3Alpha = document.getElementById("color3Alpha");
  dom.bgColorAlpha = document.getElementById("bgColorAlpha");
  dom.blockColorAlpha = document.getElementById("blockColorAlpha");
  dom.textTransparent = document.getElementById("textTransparent");
  dom.bgImageTransparent = document.getElementById("bgImageTransparent");

  // 小字
  dom.smallEnabled = document.getElementById("smallEnabled");
  dom.smallText = document.getElementById("smallText");
  dom.smallSize = document.getElementById("smallSize");
  dom.smallX = document.getElementById("smallX");
  dom.smallY = document.getElementById("smallY");
  dom.smallColor = document.getElementById("smallColor");
  dom.smallColorAlpha = document.getElementById("smallColorAlpha");
}

/* === 面板状态管理 === */

function updateCustomPanelState() {
  const panel = document.getElementById("customPanel");
  const hint = document.getElementById("customHint");
  const body = document.getElementById("customBody");
  const enabled = state.currentMode === "custom";
  if (enabled) {
    panel.classList.add("enabled");
    hint.style.display = "none";
    body.style.opacity = "1";
    body.style.pointerEvents = "auto";
  } else {
    panel.classList.remove("enabled");
    hint.style.display = "block";
    body.style.opacity = "0.4";
    body.style.pointerEvents = "none";
  }
  updateCustomImageState();
}

function updateSmallPanelState() {
  const panel = document.getElementById("smallPanel");
  panel.classList.toggle("enabled", dom.smallEnabled.checked);
}

function updateCustomImageState() {
  const imgEnabled = state.currentMode === "custom" && dom.customImageEnabled.checked;
  const row = document.getElementById("customImageRow");
  const colorArea = document.getElementById("colorArea");
  const imageHint = document.getElementById("customImageHint");
  row.classList.toggle("disabled", !imgEnabled);
  colorArea.classList.toggle("image-enabled", imgEnabled);
  imageHint.classList.toggle("show", imgEnabled);
  [dom.color1Alpha, dom.color2Alpha, dom.color3Alpha, dom.bgColorAlpha, dom.blockColorAlpha].forEach(function (el) {
    el.disabled = imgEnabled;
  });
}

// 切换背景模式时同步颜色选择器默认值
function syncColorsFromMode(mode) {
  const m = MODES[mode];
  dom.color1.value = m.fg;
  dom.color2.value = m.fg;
  dom.color3.value = m.fg;
  dom.blockColor.value = m.fg;
  if (m.bg) {
    dom.bgColor.value = m.bg;
    dom.bgColorAlpha.value = 100;
  } else {
    dom.bgColorAlpha.value = 0;
  }
  dom.color1Alpha.value = 100;
  dom.color2Alpha.value = 100;
  dom.color3Alpha.value = 100;
  dom.blockColorAlpha.value = 100;
  dom.smallColor.value = m.fg;
  dom.smallColorAlpha.value = 100;
}

/* === 英文行管理 === */

function addEnLine(text, size) {
  const enLineList = dom.enLineList;
  const row = document.createElement("div");
  row.className = "en-line";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "en-line-input";
  input.value = text || "";
  input.placeholder = "英文（单行）";
  input.addEventListener("input", renderPreview);

  const lineSizeInput = createNumberInput({
    className: "en-line-size", min: 10, max: 500, step: 5,
    value: size != null ? size : 100, title: "该行字号（占方块百分比）",
  });
  lineSizeInput.addEventListener("input", renderPreview);

  const xInput = createNumberInput({
    className: "en-line-x", min: -500, max: 500, step: 1,
    value: 0, title: "该行横坐标偏移（像素）",
  });
  xInput.addEventListener("input", renderPreview);

  const yInput = createNumberInput({
    className: "en-line-y", min: -500, max: 500, step: 1,
    value: 0, title: "该行纵坐标偏移（像素）",
  });
  yInput.addEventListener("input", renderPreview);

  const opts = document.createElement("div");
  opts.className = "en-line-opts";
  opts.appendChild(makeLabeled("字号", lineSizeInput));
  opts.appendChild(makeLabeled("横坐标偏移", xInput));
  opts.appendChild(makeLabeled("纵坐标偏移", yInput));

  row.appendChild(input);
  row.appendChild(opts);
  enLineList.appendChild(row);
}

/* === 事件绑定 === */

function bindEvents() {
  // 添加英文行
  document.getElementById("addEnBtn").addEventListener("click", function () {
    addEnLine("", 100);
    renderPreview();
  });

  // 英文整体调整
  [dom.enGlobalSize, dom.enGlobalX, dom.enGlobalY, dom.enLineSpacing].forEach(function (el) {
    el.addEventListener("input", renderPreview);
  });

  // 自动对齐开关：开启时保存字号快照，关闭时恢复
  (function () {
    let snapshot = null;
    dom.enAutoAlign.addEventListener("change", function () {
      const sizeInputs = dom.enLineList.querySelectorAll(".en-line-size");
      if (dom.enAutoAlign.checked) {
        snapshot = Array.prototype.map.call(sizeInputs, function (inp) { return inp.value; });
      } else {
        if (snapshot) {
          sizeInputs.forEach(function (inp, i) {
            if (snapshot[i] != null) inp.value = snapshot[i];
          });
          snapshot = null;
        }
      }
      renderPreview();
    });
    // 初始化：若默认开启则保存快照
    if (dom.enAutoAlign.checked) {
      const sizeInputs0 = dom.enLineList.querySelectorAll(".en-line-size");
      snapshot = Array.prototype.map.call(sizeInputs0, function (inp) { return inp.value; });
    }
  })();

  // 汉字输入：检测字符变化时自动调整字号
  let lastChars = [dom.char1.value, dom.char2.value, dom.char3.value];
  [dom.char1, dom.char2, dom.char3].forEach(function (el, i) {
    el.addEventListener("input", function () {
      const newChar = el.value.slice(0, 1);
      if (newChar !== lastChars[i]) {
        lastChars[i] = newChar;
        autoFitChar(i);
      }
      renderPreview();
    });
  });

  // 汉字字号 / 坐标
  [dom.size1, dom.size2, dom.size3].forEach(function (el) { el.addEventListener("input", renderPreview); });
  [dom.x1, dom.y1, dom.x2, dom.y2, dom.x3, dom.y3].forEach(function (el) { el.addEventListener("input", renderPreview); });
  [dom.cnGlobalSize, dom.cnGlobalX, dom.cnGlobalY].forEach(function (el) { el.addEventListener("input", renderPreview); });

  // 图片像素：debounce 后重新 autoFitAll
  let sizeInputTimer = null;
  dom.sizeInput.addEventListener("input", function () {
    renderPreview();
    clearTimeout(sizeInputTimer);
    sizeInputTimer = setTimeout(function () {
      autoFitAll();
      renderPreview();
    }, 200);
  });

  dom.sizeInputH.addEventListener("input", renderPreview);

  // 样式切换
  const modeInputs = document.querySelectorAll('input[name="bgMode"]');
  modeInputs.forEach(function (el) {
    el.addEventListener("change", function () {
      state.currentMode = el.value;
      if (el.value === "custom") {
        syncColorsFromMode(state.lastNonCustomMode);
      } else {
        state.lastNonCustomMode = el.value;
      }
      updateCustomPanelState();
      renderPreview();
    });
  });

  // 下载按钮
  document.getElementById("downloadBtn").addEventListener("click", download);
  document.getElementById("downloadSvgBtn").addEventListener("click", function () { downloadSvg("grid"); });
  document.getElementById("downloadHBtn").addEventListener("click", downloadH);
  document.getElementById("downloadHSvgBtn").addEventListener("click", downloadSvgH);

  // 自定义颜色
  [dom.color1, dom.color2, dom.color3, dom.bgColor, dom.blockColor].forEach(function (el) {
    el.addEventListener("input", renderPreview);
  });
  [dom.color1Alpha, dom.color2Alpha, dom.color3Alpha, dom.bgColorAlpha, dom.blockColorAlpha].forEach(function (el) {
    el.addEventListener("input", renderPreview);
  });

  // 自定义图片
  document.getElementById("customImageUpload").addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      const img = new Image();
      img.onload = function () {
        state.customImage = img;
        renderPreview();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
  dom.customImageEnabled.addEventListener("change", function () {
    updateCustomImageState();
    renderPreview();
  });
  [dom.textTransparent, dom.bgImageTransparent].forEach(function (el) {
    el.addEventListener("change", renderPreview);
  });

  // 小字
  dom.smallEnabled.addEventListener("change", function () {
    updateSmallPanelState();
    renderPreview();
  });
  [dom.smallText, dom.smallSize, dom.smallX, dom.smallY, dom.smallColor, dom.smallColorAlpha].forEach(function (el) {
    el.addEventListener("input", renderPreview);
  });
}

/* === 更新日志抽屉 === */

function initChangelogDrawer() {
  const drawer = document.getElementById("changelogDrawer");
  const btn = document.getElementById("changelogBtn");
  const closeBtn = document.getElementById("changelogClose");
  btn.addEventListener("click", function () {
    drawer.classList.toggle("open");
  });
  closeBtn.addEventListener("click", function () {
    drawer.classList.remove("open");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer.classList.contains("open")) {
      drawer.classList.remove("open");
    }
  });
}

/* === 加载页（Endfield 风格） === */

function initLoadingCover() {
  const cover = document.getElementById("loading-cover");
  if (!cover) return;
  document.body.style.overflow = "hidden";

  // 随机展示一句终结技
  const quoteEl = cover.querySelector("#loading-quote");
  if (quoteEl) {
    quoteEl.textContent = ULT_QUOTES[Math.floor(Math.random() * ULT_QUOTES.length)];
  }

  const percentEl = cover.querySelector(".progress-percent");
  const statusEl = cover.querySelector(".status-text");
  const phaseTexts = {
    init: "INITIALIZING",
    loading: "LOADING",
    complete: "READY",
    sweeping: "LAUNCHING",
    fadeout: "WELCOME",
  };
  function setPhase(ph) {
    cover.className = "loading-cover " + ph;
    if (statusEl) statusEl.textContent = phaseTexts[ph];
  }

  let display = 0;
  let target = 0;
  setPhase("init");
  setTimeout(function () { setPhase("loading"); }, 100);
  setTimeout(function () { if (target < 90) target = 90; }, 800);
  fontsReadyPromise.then(function () { target = 100; });

  function animate() {
    if (display < target) {
      const step = Math.max(0.5, (target - display) * 0.15);
      display = Math.min(target, display + step);
      cover.style.setProperty("--progress", display + "%");
      cover.style.setProperty("--progress-num", Math.floor(display));
      if (percentEl) percentEl.textContent = Math.floor(display) + "%";
    }
    if (display < 100) {
      requestAnimationFrame(animate);
    } else {
      setPhase("complete");
      setTimeout(function () {
        setPhase("sweeping");
        setTimeout(function () {
          setPhase("fadeout");
          setTimeout(function () {
            cover.style.display = "none";
            document.body.style.overflow = "";
            startFooterQuote();
          }, 300);
        }, 400);
      }, 100);
    }
  }
  animate();

  // 页脚终结技轮播：每 5 秒直接切换（不闪烁）
  function startFooterQuote() {
    const el = document.getElementById("footerQuote");
    if (!el) return;
    let last = -1;
    function pick() {
      if (ULT_QUOTES.length <= 1) return ULT_QUOTES[0];
      let i;
      do { i = Math.floor(Math.random() * ULT_QUOTES.length); }
      while (i === last);
      last = i;
      return ULT_QUOTES[i];
    }
    el.textContent = pick();
    setInterval(function () {
      el.textContent = pick();
    }, 5000);
  }
}

/* === 初始化 === */

function init() {
  // 1. 动态生成 HTML
  generateCharFields();
  generateColorFields();

  // 2. 填充 DOM 引用
  populateDomRefs();

  // 3. 初始化状态（currentMode 与 lastNonCustomMode 均从 DOM 读取，保持一致）
  state.currentMode = document.querySelector('input[name="bgMode"]:checked').value;
  // lastNonCustomMode：切换到 custom 时用于恢复颜色默认值，初始取当前非 custom 模式
  state.lastNonCustomMode = state.currentMode === "custom" ? "black" : state.currentMode;

  // 4. 添加默认英文行（必须在 bindEvents 之前，以便自动对齐快照保存初始值 100）
  addEnLine("ARKNIGHTS", 100);
  addEnLine("ENDFIELD", 100);

  // 5. 绑定事件
  bindEvents();

  // 6. 初始化面板状态
  updateCustomPanelState();
  updateSmallPanelState();

  // 7. 初始化日志抽屉
  initChangelogDrawer();

  // 8. 初始化加载页
  initLoadingCover();

  // 9. 加载字体（触发首次渲染）
  loadFonts();
}

init();
