(function () {
  /* === 常量 === */
  const FONT_NAME = "EndfieldFont";
  const FONT_URL = "fonts/HYLingXinSquare95W.subset.woff2";
  const EN_FONT_NAME = "HarmonyOSBlack";
  const EN_FONT_URL = "fonts/HarmonyOS_Sans_SC_Black.subset.woff2";
  const SMALL_FONT_NAME = EN_FONT_NAME; // 与英文同字体，共用一份 @font-face
  const SMALL_FONT_URL = EN_FONT_URL;

  /* === DOM 引用 === */
  const char1 = document.getElementById("char1");
  const char2 = document.getElementById("char2");
  const char3 = document.getElementById("char3");
  const size1 = document.getElementById("size1");
  const size2 = document.getElementById("size2");
  const size3 = document.getElementById("size3");
  const x1 = document.getElementById("x1");
  const y1 = document.getElementById("y1");
  const x2 = document.getElementById("x2");
  const y2 = document.getElementById("y2");
  const x3 = document.getElementById("x3");
  const y3 = document.getElementById("y3");
  const cnGlobalSize = document.getElementById("cnGlobalSize");
  const cnGlobalX = document.getElementById("cnGlobalX");
  const cnGlobalY = document.getElementById("cnGlobalY");
  const enLineList = document.getElementById("enLineList");
  const addEnBtn = document.getElementById("addEnBtn");
  const enGlobalSize = document.getElementById("enGlobalSize");
  const enGlobalX = document.getElementById("enGlobalX");
  const enGlobalY = document.getElementById("enGlobalY");
  const enLineSpacing = document.getElementById("enLineSpacing");
  const enAutoAlign = document.getElementById("enAutoAlign");
  const sizeInput = document.getElementById("sizeInput");
  const sizeInputH = document.getElementById("sizeInputH");
  const downloadBtn = document.getElementById("downloadBtn");
  const downloadSvgBtn = document.getElementById("downloadSvgBtn");
  const modeInputs = document.querySelectorAll('input[name="bgMode"]');
  const canvas = document.getElementById("preview");
  const ctx = canvas.getContext("2d");
  const canvasH = document.getElementById("previewH");
  const ctxH = canvasH.getContext("2d");
  const downloadHBtn = document.getElementById("downloadHBtn");
  const downloadHSvgBtn = document.getElementById("downloadHSvgBtn");

  // 当前绘制目标 context（drawTo 切换；所有绘制函数通过 currentCtx 访问）
  let currentCtx = ctx;

  const customPanel = document.getElementById("customPanel");
  const customHint = document.getElementById("customHint");
  const customBody = document.getElementById("customBody");
  const colorArea = document.getElementById("colorArea");
  const customImageHint = document.getElementById("customImageHint");
  const color1 = document.getElementById("color1");
  const color2 = document.getElementById("color2");
  const color3 = document.getElementById("color3");
  const bgColor = document.getElementById("bgColor");
  const blockColorInput = document.getElementById("blockColor");
  const color1Alpha = document.getElementById("color1Alpha");
  const color2Alpha = document.getElementById("color2Alpha");
  const color3Alpha = document.getElementById("color3Alpha");
  const bgColorAlpha = document.getElementById("bgColorAlpha");
  const blockColorAlpha = document.getElementById("blockColorAlpha");
  const customImageEnabled = document.getElementById("customImageEnabled");
  const customImageUpload = document.getElementById("customImageUpload");
  const customImageRow = document.getElementById("customImageRow");
  const textTransparentRadio = document.getElementById("textTransparent");
  const bgImageTransparentRadio = document.getElementById("bgImageTransparent");

  // 小字板块
  const smallPanel = document.getElementById("smallPanel");
  const smallBody = document.getElementById("smallBody");
  const smallEnabled = document.getElementById("smallEnabled");
  const smallText = document.getElementById("smallText");
  const smallSize = document.getElementById("smallSize");
  const smallX = document.getElementById("smallX");
  const smallY = document.getElementById("smallY");
  const smallColor = document.getElementById("smallColor");
  const smallColorAlpha = document.getElementById("smallColorAlpha");

  /* === 状态变量 === */
  let fontReady = false;
  let enFontReady = false;
  let smallFontReady = false;
  let fontsReadyResolve = null;
  const fontsReadyPromise = new Promise(function (r) { fontsReadyResolve = r; });
  let customImage = null; // 用户上传的自定义图片
  let lastNonCustomMode = "black"; // 上一个非自定义模式，用于切换到自定义时同步默认色
  let currentMode = document.querySelector('input[name="bgMode"]:checked').value;

  /* === 模式定义 === */
  // bg: 背景色（null 表示透明），fg: 默认前景色，label: 显示名称
  const MODES = {
    black: { bg: "#000000", fg: "#ffffff", label: "黑底白字" },
    white: { bg: "#ffffff", fg: "#000000", label: "白底黑字" },
    transparent: { bg: null, fg: "#ffffff", label: "透明白字" },
    transparent_black: { bg: null, fg: "#000000", label: "透明黑字" },
    custom: { bg: null, fg: "#ffffff", label: "自定义" },
  };

  function getMode() {
    return currentMode;
  }

  /* === 工具函数 === */

  // hex + 透明度百分比 -> rgba 字符串（透明度 100% 时返回原 hex）
  function withAlpha(hex, alphaPercent) {
    // 注意：0 是合法透明度值，不能用 || 兜底（0 || 100 会变 100）
    const num = Number(alphaPercent);
    const a = Math.max(0, Math.min(100, isNaN(num) ? 100 : num)) / 100;
    if (a >= 1) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
  }

  // ArrayBuffer 转 Base64（分块处理避免栈溢出）
  function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  // SVG 文本转义
  function esc(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* === 字体加载 === */
  // FontFace 用 URL 字符串让浏览器原生下载（最可靠）
  // Base64 转换改为惰性按需获取（仅 SVG 下载时），避免阻塞首屏
  async function loadFonts() {
    const cnFace = new FontFace(FONT_NAME, "url(" + FONT_URL + ")");
    const enFace = new FontFace(EN_FONT_NAME, "url(" + EN_FONT_URL + ")");
    // SMALL 复用 EN 字体（同文件、同 family 名），无需单独 FontFace

    const [cnLoad, enLoad] = await Promise.allSettled([
      cnFace.load(),
      enFace.load(),
    ]);

    if (cnLoad.status === "fulfilled") {
      document.fonts.add(cnFace);
      fontReady = true;
    } else {
      console.error("中文字体加载失败:", cnLoad.reason);
    }

    if (enLoad.status === "fulfilled") {
      document.fonts.add(enFace);
      enFontReady = true;
      smallFontReady = true; // SMALL 复用 EN 字体
    } else {
      console.error("英文字体加载失败:", enLoad.reason);
    }

    if (fontsReadyResolve) fontsReadyResolve();
    autoFitAll();
    renderPreview();
  }

  // SVG 导出用：惰性获取字体 Base64（只在下载 SVG 时按需 fetch，结果缓存复用）
  const base64Cache = {};
  function fetchFontBase64(url) {
    if (!base64Cache[url]) {
      base64Cache[url] = fetch(url)
        .then(function (r) { return r.arrayBuffer(); })
        .then(arrayBufferToBase64);
    }
    return base64Cache[url];
  }

  /* === 字形测量与绘制 === */

  // 计算字形度量（drawGlyph 和 glyphSvg 共用）
  // 返回 { font: 实际字号, drawX: 绘制 x 偏移, drawY: 绘制 y 偏移 }
  function calcGlyphMetrics(cellSize, char, scale) {
    currentCtx.font = cellSize + "px " + FONT_NAME;
    const m = currentCtx.measureText(char);
    const inkW = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) || cellSize;
    const s = cellSize * (cellSize / inkW) * scale;
    currentCtx.font = s + "px " + FONT_NAME;
    const sm = currentCtx.measureText(char);
    const sw = sm.actualBoundingBoxLeft + sm.actualBoundingBoxRight;
    const sh = sm.actualBoundingBoxAscent + sm.actualBoundingBoxDescent;
    return {
      font: s,
      drawX: (cellSize - sw) / 2 - sm.actualBoundingBoxLeft,
      drawY: (cellSize - sh) / 2 + sm.actualBoundingBoxAscent,
    };
  }

  // Canvas 绘制单个汉字
  function drawGlyph(x, y, cellSize, char, scale) {
    if (!char) return;
    const g = calcGlyphMetrics(cellSize, char, scale);
    // calcGlyphMetrics 末尾已设置 currentCtx.font，此处无需重复
    currentCtx.fillText(char, x + g.drawX, y + g.drawY);
  }

  // 生成 SVG <text> 元素（复刻 drawGlyph 的度量计算）
  function glyphSvg(x, y, cellSize, char, scale, fill) {
    if (!char) return "";
    const g = calcGlyphMetrics(cellSize, char, scale);
    return '<text x="' + (x + g.drawX).toFixed(2) + '" y="' + (y + g.drawY).toFixed(2) +
      '" font-family="' + FONT_NAME + '" font-size="' + g.font.toFixed(2) +
      '" fill="' + fill + '">' + esc(char) + "</text>";
  }

  /* === 像素扫描（自动调整字号用） === */

  // 创建扫描函数：在临时画布上绘制字符并扫描实际像素边界
  // 完全复刻 drawGlyph 的字号计算与居中逻辑，确保扫描结果与实际绘制一致
  function makeScanPixels(ch, cellSize, pad) {
    if (!ch) return null;
    currentCtx.font = cellSize + "px " + FONT_NAME;
    const m = currentCtx.measureText(ch);
    const inkW = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) || cellSize;

    return function scanPixels(scale) {
      const s = cellSize * (cellSize / inkW) * scale;
      currentCtx.font = s + "px " + FONT_NAME;
      const sm = currentCtx.measureText(ch);
      const sw = sm.actualBoundingBoxLeft + sm.actualBoundingBoxRight;
      const sh = sm.actualBoundingBoxAscent + sm.actualBoundingBoxDescent;
      const drawX = (cellSize - sw) / 2 - sm.actualBoundingBoxLeft;
      const drawY = (cellSize - sh) / 2 + sm.actualBoundingBoxAscent;

      const tmpW = Math.ceil(cellSize + pad * 2);
      const tmpH = Math.ceil(cellSize + pad * 2);
      const tmp = document.createElement("canvas");
      tmp.width = tmpW;
      tmp.height = tmpH;
      const tctx = tmp.getContext("2d");
      tctx.font = s + "px " + FONT_NAME;
      tctx.fillStyle = "#ffffff";
      tctx.fillText(ch, drawX + pad, drawY + pad);

      const data = tctx.getImageData(0, 0, tmpW, tmpH).data;
      let minX = tmpW, maxX = -1, minY = tmpH, maxY = -1;
      for (let py = 0; py < tmpH; py++) {
        for (let px = 0; px < tmpW; px++) {
          if (data[(py * tmpW + px) * 4 + 3] > 0) {
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          }
        }
      }
      if (maxX < 0) return null;
      return {
        actLeft: minX - pad,
        actTop: minY - pad,
        actW: maxX - minX + 1,
        actH: maxY - minY + 1,
      };
    };
  }

  // 自动调整单个字符的字号和偏移，使其紧贴格子边缘
  // 在实际渲染 cellSize 下扫描，消除字体度量非线性导致的跨尺寸偏移
  function autoFitChar(index) {
    if (!fontReady) return;
    const inputs = [
      { char: char1, x: x1, y: y1, size: size1 },
      { char: char2, x: x2, y: y2, size: size2 },
      { char: char3, x: x3, y: y3, size: size3 },
    ];
    const inp = inputs[index];
    const ch = inp.char.value.slice(0, 1);
    if (!ch) return;

    // 用实际渲染尺寸扫描，避免字体度量非线性导致的偏移
    const renderSize = Math.min(Math.max(Math.round(Number(sizeInput.value) || 512), 64), 4096);
    const cellSize = renderSize / 2;
    const offScale = renderSize / 512; // 512 基准缩放（getDrawParams 会乘回）
    const pad = Math.ceil(cellSize * 0.234); // 按比例留白，防止字形超出扫描区
    const target = cellSize + 2;
    const scanPixels = makeScanPixels(ch, cellSize, pad);

    // 迭代收敛：调整 scale 使字符宽高都紧贴 target
    let scale = (Number(inp.size.value) || 100) / 100;
    for (let iter = 0; iter < 10; iter++) {
      const r = scanPixels(scale);
      if (!r) return;
      scale *= Math.min(target / r.actW, target / r.actH);
    }

    // 字号 +1（用户要求），坐标用原判定量计算
    inp.size.value = Math.round(scale * 100) + 1;
    const r = scanPixels(scale);
    if (!r) return;

    // 根据位置计算偏移：上左(0)靠左上，上右(1)靠右上，下左(2)靠左下
    let offsetX, offsetY;
    if (index === 0) {
      offsetX = Math.floor(-r.actLeft);
      offsetY = Math.floor(-r.actTop);
    } else if (index === 1) {
      offsetX = Math.ceil(cellSize - r.actW - r.actLeft);
      offsetY = Math.floor(-r.actTop);
    } else {
      offsetX = Math.floor(-r.actLeft);
      offsetY = Math.ceil(cellSize - r.actH - r.actTop);
    }

    // 转回 512 基准存储（渲染时 getDrawParams 会乘 offScale 还原为实际像素）
    inp.x.value = Math.round(offsetX / offScale);
    inp.y.value = Math.round(offsetY / offScale);
  }

  function autoFit(index) {
    autoFitChar(index);
  }

  // 三个汉字全部自动调整（size 变化或初始化时调用）
  function autoFitAll() {
    autoFitChar(0);
    autoFitChar(1);
    autoFitChar(2);
  }

  /* === 颜色解析 === */

  // 自定义模式：仅当样式选为 custom 时启用
  function isCustomEnabled() {
    return getMode() === "custom";
  }

  // 解析当前生效的配色
  // 返回 { bg, fg, charColors, enColors, blockColor, enKnockout }
  function resolveColors(mode) {
    const m = MODES[mode];
    const enabled = isCustomEnabled();
    const charColors = enabled
      ? [
          withAlpha(color1.value, color1Alpha.value),
          withAlpha(color2.value, color2Alpha.value),
          withAlpha(color3.value, color3Alpha.value),
        ]
      : [m.fg, m.fg, m.fg];
    let bg;
    if (enabled) {
      const bgA = Math.max(0, Math.min(100, Number(bgColorAlpha.value) || 100)) / 100;
      bg = bgA <= 0 ? null : withAlpha(bgColor.value, bgColorAlpha.value);
    } else {
      bg = m.bg;
    }
    const blockColor = enabled ? withAlpha(blockColorInput.value, blockColorAlpha.value) : m.fg;
    const enColor = bg ? bg : blockColor;
    const enColors = getEnLines().map(function () { return enColor; });
    // 英文挖空：仅透明模式且未启用自定义时
    const enKnockout = !enabled && (mode === "transparent" || mode === "transparent_black");
    // 小字颜色：自定义时用自定义色，否则用前景色
    const smallColorVal = enabled ? withAlpha(smallColor.value, smallColorAlpha.value) : m.fg;
    return {
      bg: bg,
      fg: m.fg,
      charColors: charColors,
      enColors: enColors,
      blockColor: blockColor,
      enKnockout: enKnockout,
      smallColor: smallColorVal,
    };
  }

  /* === 自定义面板状态 === */

  function updateCustomPanelState() {
    const enabled = isCustomEnabled();
    if (enabled) {
      customPanel.classList.add("enabled");
      customHint.style.display = "none";
      customBody.style.opacity = "1";
      customBody.style.pointerEvents = "auto";
    } else {
      customPanel.classList.remove("enabled");
      customHint.style.display = "block";
      customBody.style.opacity = "0.4";
      customBody.style.pointerEvents = "none";
    }
    updateCustomImageState();
  }

  /* === 小字面板状态 === */

  function isSmallEnabled() {
    return smallEnabled.checked;
  }

  function updateSmallPanelState() {
    smallPanel.classList.toggle("enabled", isSmallEnabled());
  }

  // 自定义图片：仅当 custom 模式 + 勾选启用 + 已上传图片时生效
  function isCustomImageEnabled() {
    return isCustomEnabled() && customImageEnabled.checked && !!customImage;
  }

  // 自定义图片模式：textTransparent（文字透明）/ bgTransparent（背景透明）
  function getImageMode() {
    return textTransparentRadio.checked ? "textTransparent" : "bgTransparent";
  }

  // 启用自定义图片后，禁用颜色选择器和透明度滑块
  function updateCustomImageState() {
    const imgEnabled = isCustomEnabled() && customImageEnabled.checked;
    customImageRow.classList.toggle("disabled", !imgEnabled);
    colorArea.classList.toggle("image-enabled", imgEnabled);
    customImageHint.classList.toggle("show", imgEnabled);
    [color1Alpha, color2Alpha, color3Alpha, bgColorAlpha, blockColorAlpha].forEach(function (el) {
      el.disabled = imgEnabled;
    });
  }

  // 切换背景模式时同步颜色选择器默认值
  function syncColorsFromMode(mode) {
    const m = MODES[mode];
    color1.value = m.fg;
    color2.value = m.fg;
    color3.value = m.fg;
    blockColorInput.value = m.fg;
    if (m.bg) {
      bgColor.value = m.bg;
      bgColorAlpha.value = 100;
    } else {
      bgColorAlpha.value = 0; // 透明模式：背景透明度为 0
    }
    color1Alpha.value = 100;
    color2Alpha.value = 100;
    color3Alpha.value = 100;
    blockColorAlpha.value = 100;
  }

  /* === 图片绘制 === */

  // 绘制图片铺满画布（cover 模式，保持比例）
  function drawImageCover(img, w, h) {
    const ratio = Math.max(w / img.width, h / img.height);
    const iw = img.width * ratio;
    const ih = img.height * ratio;
    currentCtx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
  }

  /* === 英文换行与绘制 === */

  // 英文文本换行（drawEnglish 和 downloadSvg 共用）
  function wrapText(text, maxWidth, fontSize) {
    currentCtx.font = fontSize + "px " + EN_FONT_NAME;
    const lines = [];
    text.split("\n").forEach(function (para) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = "";
      words.forEach(function (w) {
        const t = line ? line + " " + w : w;
        if (!line || currentCtx.measureText(t).width <= maxWidth) {
          line = t;
        } else {
          lines.push(line);
          line = w;
        }
      });
      if (line) lines.push(line);
    });
    return lines;
  }

  // 计算英文文本块的位置和字号（drawEnglish 和 downloadSvg 共用）
  // p 包含 cell, centerX, yBase, offScale（田字格和横排不同）
  // 返回 [{ text, x, y, font, color }] 数组
  function calcEnglishBlocks(p, colors) {
    const allLines = getEnLines();
    const lines = [];
    allLines.forEach(function (l, i) {
      if (l.text.trim()) {
        lines.push({
          text: l.text, size: l.size, x: l.x, y: l.y,
          color: colors.enColors[i] != null ? colors.enColors[i] : "#000000",
          srcIndex: i, // 保留原始索引，用于回写字号
        });
      }
    });
    if (!enFontReady || !lines.length) return [];

    const cell = p.cell;
    const pad = cell * 0.06;
    const maxW = cell - pad * 2;
    const centerX = p.centerX;
    const last = lines.length - 1;
    const offScale = p.offScale;
    const lineSpacing = Number(enLineSpacing.value) || 0.85;
    const globalSize = (Number(enGlobalSize.value) || 100) / 100;
    const globalX = (Number(enGlobalX.value) || 0) * offScale;
    const globalY = (Number(enGlobalY.value) || 0) * offScale;

    // 计算每行的换行和字号（自适应缩放直到宽度合适）
    const blocks = lines.map(function (l) {
      let fs = cell * 0.14 * (l.size / 100) * globalSize;
      let ls = wrapText(l.text, maxW, fs);
      while (fs > 4) {
        currentCtx.font = fs + "px " + EN_FONT_NAME;
        const widest = ls.reduce(function (mx, s) {
          return Math.max(mx, currentCtx.measureText(s).width);
        }, 0);
        if (widest <= maxW) break;
        fs *= 0.92;
        ls = wrapText(l.text, maxW, fs);
      }
      return { lines: ls, font: fs, x: l.x * offScale, y: l.y * offScale, color: l.color, srcSize: l.size, srcIndex: l.srcIndex };
    });

    // 自动对齐：以占用宽度最长的行为基准，放大其他行字号使各行占用宽度一致
    if (enAutoAlign.checked) {
      // 计算每行最宽子行的宽度
      blocks.forEach(function (b) {
        currentCtx.font = b.font + "px " + EN_FONT_NAME;
        b.widest = b.lines.reduce(function (mx, s) {
          return Math.max(mx, currentCtx.measureText(s).width);
        }, 0);
      });
      // 找出目标宽度（所有行中最宽的）
      const targetW = blocks.reduce(function (mx, b) {
        return Math.max(mx, b.widest);
      }, 0);
      // 放大其他行字号（目标宽度必然 <= maxW，因此放大后不会超限）
      // 同时把放大后的等效 size 回写到对应行的字号输入框
      const sizeInputs = enLineList.querySelectorAll(".en-line-size");
      blocks.forEach(function (b) {
        if (b.widest > 0 && b.widest < targetW) {
          const ratio = targetW / b.widest;
          b.font *= ratio;
          // 回写等效字号（保留原始 size 的比例）
          const newSize = Math.round(b.srcSize * ratio);
          const input = sizeInputs[b.srcIndex];
          if (input && Number(input.value) !== newSize) {
            input.value = newSize;
          }
        }
      });
    }

    // 计算总高度，若超出格子则压缩非末行
    const totalRaw = blocks.reduce(function (s, b) {
      return s + b.lines.length * b.font * lineSpacing;
    }, 0);
    const lastH = blocks[last].lines.length * blocks[last].font * lineSpacing;
    const restH = totalRaw - lastH;
    let factor = 1;
    if (restH > 0 && totalRaw > cell - pad) {
      factor = Math.max((cell - pad - lastH) / restH, 0);
    }

    // 从下往上排列，收集所有文本的位置
    const texts = [];
    let yBase = p.yBase;
    for (let bi = blocks.length - 1; bi >= 0; bi--) {
      const b = blocks[bi];
      const f = bi === last ? 1 : factor;
      for (let li = b.lines.length - 1; li >= 0; li--) {
        const fs = b.font * f;
        texts.push({
          text: b.lines[li],
          x: centerX + globalX + b.x,
          y: yBase + globalY + b.y,
          font: fs,
          color: b.color,
        });
        yBase -= fs * lineSpacing;
      }
    }
    return texts;
  }

  // 在 Canvas 上绘制英文（支持普通填充和挖空两种模式）
  function drawEnglish(p, colors) {
    const texts = calcEnglishBlocks(p, colors);
    if (!texts.length) return;

    const knockout = colors.enKnockout;

    currentCtx.textAlign = "center";
    currentCtx.textBaseline = "alphabetic"; // 重置（drawSmallText 改成了 top）
    if (knockout) {
      currentCtx.globalCompositeOperation = "destination-out";
      currentCtx.fillStyle = "#ffffff";
    }

    texts.forEach(function (t) {
      if (!knockout) {
        currentCtx.fillStyle = t.color;
      }
      currentCtx.font = t.font + "px " + EN_FONT_NAME;
      currentCtx.fillText(t.text, t.x, t.y);
    });

    currentCtx.textAlign = "left";
    currentCtx.globalCompositeOperation = "source-over";
  }

  /* === 绘制参数解析（draw 和 downloadSvg 共用） === */

  // layout: 'grid'（田字格，正方形画布）或 'row'（横排，2:1 画布）
  // sizeOverride: 可选，横排用独立像素值
  function getDrawParams(layout, sizeOverride) {
    const rawSize = sizeOverride != null ? sizeOverride : Number(sizeInput.value);
    const size = Math.min(Math.max(Math.round(rawSize || 512), 64), 4096);
    const cell = size / 2;
    const offScale = size / 512;
    const chars = [char1.value.slice(0, 1), char2.value.slice(0, 1), char3.value.slice(0, 1)];
    const scales = [
      (Number(size1.value) || 100) / 100,
      (Number(size2.value) || 100) / 100,
      (Number(size3.value) || 100) / 100,
    ];
    const cnGlobalScale = (Number(cnGlobalSize.value) || 100) / 100;
    const offsets = [
      [(Number(x1.value) || 0) * offScale, (Number(y1.value) || 0) * offScale],
      [(Number(x2.value) || 0) * offScale, (Number(y2.value) || 0) * offScale],
      [(Number(x3.value) || 0) * offScale, (Number(y3.value) || 0) * offScale],
    ];
    const cnOffX = (Number(cnGlobalX.value) || 0) * offScale;
    const cnOffY = (Number(cnGlobalY.value) || 0) * offScale;

    // 田字格：正方形画布 size×size，四格 2×2，矩形在右下
    // 横排：画布宽度 2size，高度仅 1 个 cell（紧贴实际内容，不卡死 2:1）
    let canvasW, canvasH, positions, blockX, blockY, centerX, yBase;
    const pad = cell * 0.06;
    if (layout === "row") {
      canvasW = size * 2;
      canvasH = cell; // 仅保留实际内容高度（1 个 cell），不卡死 2:1
      const gy = 0; // 内容从顶部开始，无垂直留白
      positions = [[0, gy], [cell, gy], [cell * 2, gy]];
      blockX = cell * 3;
      blockY = gy;
      centerX = blockX + cell / 2;
      yBase = gy + cell - pad;
    } else {
      canvasW = size;
      canvasH = size;
      positions = [[0, 0], [cell, 0], [0, cell]];
      blockX = cell;
      blockY = cell;
      centerX = blockX + cell / 2;
      yBase = size - pad;
    }

    // 小字开启时：画布顶部额外增加 smallH（不压缩格子内容）
    // 布局：上边距 → 小字 → 间距 → 汉字顶部（紧贴左上字上方）
    // 小字字号按 cell 比例计算，预览比例稳定（不随图片像素缩放）
    const smallOn = isSmallEnabled() && smallFontReady && smallText.value.trim();
    let smallH = 0;
    let smallSizePx = 0;
    let smallDrawX = 0;
    let smallDrawY = 0;
    if (smallOn) {
      // smallSize 是相对 cell 的百分比（如 24 表示占 cell 的 24%）
      smallSizePx = cell * (Number(smallSize.value) || 24) / 100;
      const gap = smallSizePx * 0.03; // 小字底部到汉字顶部的间距
      smallH = smallSizePx + gap; // 画布额外增加的高度
      canvasH += smallH;
      positions = positions.map(function (pos) { return [pos[0], pos[1] + smallH]; });
      blockY += smallH;
      yBase += smallH;
      // 小字紧贴左上字上方：左对齐左上字 x，底部距汉字顶部 gap
      // 汉字顶部在 positions[0][1]，小字顶部 = 汉字顶部 - gap - smallSizePx
      smallDrawX = positions[0][0] + (Number(smallX.value) || 0) * offScale;
      smallDrawY = positions[0][1] - gap - smallSizePx + (Number(smallY.value) || 0) * offScale;
    }

    return {
      layout: layout, size: size, canvasW: canvasW, canvasH: canvasH,
      cell: cell, offScale: offScale, chars: chars,
      positions: positions, scales: scales, cnGlobalScale: cnGlobalScale,
      offsets: offsets, cnOffX: cnOffX, cnOffY: cnOffY,
      blockX: blockX, blockY: blockY, blockW: cell, blockH: cell,
      centerX: centerX, yBase: yBase,
      smallOn: smallOn, smallText: smallOn ? smallText.value : "",
      smallSizePx: smallSizePx, smallDrawX: smallDrawX, smallDrawY: smallDrawY,
    };
  }

  // 绘制汉字（指定填充样式，draw 和 drawImage 模式共用）
  // fontReady 由加载页门控，此处恒为 true；字体未就绪时 drawGlyph 内部用 fallback 字体度量，仍可正常绘制
  function drawChars(params, fillStyle) {
    currentCtx.fillStyle = fillStyle;
    currentCtx.textBaseline = "alphabetic"; // 重置（drawSmallText 改成了 top）
    params.chars.forEach(function (ch, i) {
      drawGlyph(
        params.positions[i][0] + params.offsets[i][0] + params.cnOffX,
        params.positions[i][1] + params.offsets[i][1] + params.cnOffY,
        params.cell, ch, params.scales[i] * params.cnGlobalScale
      );
    });
  }

  /* === 主绘制函数 === */

  // 绘制小字（左上字上方，左对齐）
  function drawSmallText(p, fillStyle) {
    if (!p.smallOn) return;
    currentCtx.font = p.smallSizePx + "px " + SMALL_FONT_NAME;
    currentCtx.fillStyle = fillStyle;
    currentCtx.textAlign = "left";
    currentCtx.textBaseline = "top";
    currentCtx.fillText(p.smallText, p.smallDrawX, p.smallDrawY);
  }

  // 核心绘制：在 targetCtx 对应的 canvas 上按 params 绘制
  function drawTo(targetCtx, p, colors) {
    currentCtx = targetCtx;
    const targetCanvas = targetCtx.canvas;
    targetCanvas.width = p.canvasW;
    targetCanvas.height = p.canvasH;

    /* --- 自定义图片模式 --- */
    if (isCustomImageEnabled()) {
      const imgMode = getImageMode();
      if (imgMode === "textTransparent") {
        // 文字透明：图片铺满作为材质，文字位置（含小字）挖空
        drawImageCover(customImage, p.canvasW, p.canvasH);
        currentCtx.globalCompositeOperation = "destination-out";
        drawChars(p, "#ffffff");
        drawSmallText(p, "#ffffff");
        currentCtx.globalCompositeOperation = "source-over";
        colors.enKnockout = true;
        drawEnglish(p, colors);
      } else {
        // 背景透明：背景透明，文字/矩形/小字用图片材质填充，英文挖空透明
        currentCtx.clearRect(0, 0, p.canvasW, p.canvasH);
        // 创建 cover pattern
        const tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = p.canvasW;
        tmpCanvas.height = p.canvasH;
        const tmpCtx = tmpCanvas.getContext("2d");
        const ratio = Math.max(p.canvasW / customImage.width, p.canvasH / customImage.height);
        const iw = customImage.width * ratio;
        const ih = customImage.height * ratio;
        tmpCtx.drawImage(customImage, (p.canvasW - iw) / 2, (p.canvasH - ih) / 2, iw, ih);
        const pattern = currentCtx.createPattern(tmpCanvas, "no-repeat");
        // 1. 画汉字 pattern
        drawChars(p, pattern);
        // 2. 画小字 pattern
        drawSmallText(p, pattern);
        // 3. 画矩形 pattern
        currentCtx.fillStyle = pattern;
        currentCtx.fillRect(p.blockX, p.blockY, p.blockW, p.blockH);
        // 4. 挖空英文位置（最后挖，不影响矩形和汉字）
        colors.enKnockout = true;
        drawEnglish(p, colors);
      }
      return;
    }

    /* --- 普通模式 --- */
    // 背景：先清空，再画带透明度的背景色
    currentCtx.clearRect(0, 0, p.canvasW, p.canvasH);
    if (colors.bg) {
      currentCtx.fillStyle = colors.bg;
      currentCtx.fillRect(0, 0, p.canvasW, p.canvasH);
    }

    // 小字（汉字之前绘制，避免被覆盖）
    drawSmallText(p, colors.smallColor);

    // 逐字绘制（各自颜色）；fontReady 由加载页门控恒为 true
    p.chars.forEach(function (ch, i) {
      currentCtx.fillStyle = colors.charColors[i];
      drawGlyph(
        p.positions[i][0] + p.offsets[i][0] + p.cnOffX,
        p.positions[i][1] + p.offsets[i][1] + p.cnOffY,
        p.cell, ch, p.scales[i] * p.cnGlobalScale
      );
    });

    // 右下角方块
    currentCtx.fillStyle = colors.blockColor;
    currentCtx.fillRect(p.blockX, p.blockY, p.blockW, p.blockH);

    // 英文
    drawEnglish(p, colors);
  }

  // 田字格预览
  function draw(mode) {
    drawTo(ctx, getDrawParams("grid"), resolveColors(mode));
  }

  // 横排预览（用横排独立像素）
  function drawH(mode) {
    drawTo(ctxH, getDrawParams("row", Number(sizeInputH.value)), resolveColors(mode));
  }

  /* === 预览渲染（RAF 节流，同时渲染田字格和横排） === */

  let rafId = null;
  function renderPreview() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      rafId = null;
      const mode = getMode();
      draw(mode);
      drawH(mode);
    });
  }

  /* === 下载 === */

  // 通用：在指定 canvas 上绘制并导出 PNG
  function downloadBlobTo(targetCanvas, p, mode, filename) {
    drawTo(targetCanvas.getContext("2d"), p, resolveColors(mode));
    targetCanvas.toBlob(function (blob) {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  }

  // 文件名：用户输入的三个字 + 下划线 + 模式名
  function getCharName() {
    const c1 = char1.value.slice(0, 1) || "_";
    const c2 = char2.value.slice(0, 1) || "_";
    const c3 = char3.value.slice(0, 1) || "_";
    return c1 + c2 + c3;
  }

  function download() {
    downloadBlobTo(canvas, getDrawParams("grid"), getMode(), getCharName() + "_" + getMode() + ".png");
  }

  function downloadH() {
    downloadBlobTo(canvasH, getDrawParams("row", Number(sizeInputH.value)), getMode(), getCharName() + "_" + getMode() + "_h.png");
  }

  // 下载 SVG（矢量导出，嵌入字体 Base64 保证字体显示）
  // layout: 'grid' 或 'row'；sizeOverride: 横排独立像素
  async function downloadSvg(layout, sizeOverride) {
    const mode = getMode();
    const colors = resolveColors(mode);
    const p = getDrawParams(layout, sizeOverride);
    const knockout = colors.enKnockout;
    const englishTexts = calcEnglishBlocks(p, colors);
    const w = p.canvasW, h = p.canvasH;
    const suffix = layout === "row" ? "_h" : "";

    let svg = '<?xml version="1.0" encoding="UTF-8"?>';
    svg += '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '">';

    // 嵌入字体（Base64 数据 URI，CDATA 包裹防止 XML 解析问题）
    // 惰性获取：仅在导出 SVG 时 fetch，结果缓存复用；SMALL 复用 EN 字体，只嵌入两份 @font-face
    const [cnB64, enB64] = await Promise.all([
      fetchFontBase64(FONT_URL).catch(function () { return ""; }),
      fetchFontBase64(EN_FONT_URL).catch(function () { return ""; }),
    ]);
    let cssRules = "";
    if (cnB64) {
      cssRules += "@font-face { font-family: '" + FONT_NAME + "'; src: url('data:application/octet-stream;base64," + cnB64 + "'); }";
    }
    if (enB64) {
      cssRules += "@font-face { font-family: '" + EN_FONT_NAME + "'; src: url('data:application/octet-stream;base64," + enB64 + "'); }";
    }
    if (cssRules) {
      svg += "<style type=\"text/css\"><![CDATA[" + cssRules + "]]></style>";
    }

    /* --- 自定义图片模式：单独构建 SVG --- */
    if (isCustomImageEnabled()) {
      // 获取 cover 模式图片的 data URL
      const tmpC = document.createElement("canvas");
      tmpC.width = w;
      tmpC.height = h;
      const tmpCx = tmpC.getContext("2d");
      const ir = Math.max(w / customImage.width, h / customImage.height);
      const iw = customImage.width * ir;
      const ih = customImage.height * ir;
      tmpCx.drawImage(customImage, (w - iw) / 2, (h - ih) / 2, iw, ih);
      const imgDataUrl = tmpC.toDataURL("image/png");
      const imgMode = getImageMode();

      if (imgMode === "textTransparent") {
        // 图片铺满 + mask 挖空文字位置（含小字）
        svg += '<defs><mask id="imgTextMask">';
        svg += '<rect width="' + w + '" height="' + h + '" fill="white"/>';
        if (fontReady) {
          p.chars.forEach(function (ch, i) {
            svg += glyphSvg(
              p.positions[i][0] + p.offsets[i][0] + p.cnOffX,
              p.positions[i][1] + p.offsets[i][1] + p.cnOffY,
              p.cell, ch, p.scales[i] * p.cnGlobalScale, "#000000"
            );
          });
        }
        svg += smallTextSvg(p, "#000000");
        svg += englishSvg(englishTexts, "#000000");
        svg += "</mask></defs>";
        svg += '<image href="' + imgDataUrl + '" width="' + w + '" height="' + h + '" mask="url(#imgTextMask)"/>';
      } else {
        // 背景透明 + 图片 pattern 填充文字/矩形，英文挖空透明
        svg += '<defs><pattern id="imgPattern" width="' + w + '" height="' + h + '" patternUnits="userSpaceOnUse">';
        svg += '<image href="' + imgDataUrl + '" width="' + w + '" height="' + h + '"/>';
        svg += "</pattern></defs>";
        // 汉字用 pattern 填充
        if (fontReady) {
          p.chars.forEach(function (ch, i) {
            svg += glyphSvg(
              p.positions[i][0] + p.offsets[i][0] + p.cnOffX,
              p.positions[i][1] + p.offsets[i][1] + p.cnOffY,
              p.cell, ch, p.scales[i] * p.cnGlobalScale, "url(#imgPattern)"
            );
          });
        }
        // 小字用 pattern 填充
        svg += smallTextSvg(p, "url(#imgPattern)");
        // 矩形用 pattern 填充（mask 挖空英文）
        svg += '<defs><mask id="blockMask">';
        svg += '<rect x="' + p.blockX + '" y="' + p.blockY + '" width="' + p.blockW + '" height="' + p.blockH + '" fill="white"/>';
        svg += englishSvg(englishTexts, "#000000");
        svg += "</mask></defs>";
        svg += '<rect x="' + p.blockX + '" y="' + p.blockY + '" width="' + p.blockW + '" height="' + p.blockH + '" fill="url(#imgPattern)" mask="url(#blockMask)"/>';
      }

      svg += "</svg>";
      downloadSvgBlob(svg, mode, suffix);
      return;
    }

    /* --- 普通模式 SVG --- */
    if (colors.bg) {
      svg += '<rect width="' + w + '" height="' + h + '" fill="' + colors.bg + '"/>';
    }

    // 小字（汉字之前绘制）
    svg += smallTextSvg(p, colors.smallColor);

    if (knockout) {
      // 透明模式：汉字直接绘制，方块+英文用 mask 挖空
      if (fontReady) {
        p.chars.forEach(function (ch, i) {
          svg += glyphSvg(
            p.positions[i][0] + p.offsets[i][0] + p.cnOffX,
            p.positions[i][1] + p.offsets[i][1] + p.cnOffY,
            p.cell, ch, p.scales[i] * p.cnGlobalScale, colors.charColors[i]
          );
        });
      }
      svg += '<defs><mask id="blockMask">';
      svg += '<rect x="' + p.blockX + '" y="' + p.blockY + '" width="' + p.blockW + '" height="' + p.blockH + '" fill="white"/>';
      svg += englishSvg(englishTexts, "#000000");
      svg += "</mask></defs>";
      svg += '<rect x="' + p.blockX + '" y="' + p.blockY + '" width="' + p.blockW + '" height="' + p.blockH + '" fill="' + colors.blockColor + '" mask="url(#blockMask)"/>';
    } else {
      // 非透明模式：汉字、方块、英文分别绘制
      if (fontReady) {
        p.chars.forEach(function (ch, i) {
          svg += glyphSvg(
            p.positions[i][0] + p.offsets[i][0] + p.cnOffX,
            p.positions[i][1] + p.offsets[i][1] + p.cnOffY,
            p.cell, ch, p.scales[i] * p.cnGlobalScale, colors.charColors[i]
          );
        });
      } else {
        p.chars.forEach(function (ch, i) {
          if (!ch) return;
          svg += '<text x="' + (p.positions[i][0] + p.cell / 2) + '" y="' + (p.positions[i][1] + p.cell / 2) +
            '" font-size="' + (p.cell * 0.8) + '" fill="' + colors.charColors[i] +
            '" text-anchor="middle" dominant-baseline="middle">' + esc(ch) + "</text>";
        });
      }
      svg += '<rect x="' + p.blockX + '" y="' + p.blockY + '" width="' + p.blockW + '" height="' + p.blockH + '" fill="' + colors.blockColor + '"/>';
      svg += englishSvg(englishTexts, null);
    }

    svg += "</svg>";
    downloadSvgBlob(svg, mode, suffix);
  }

  function downloadSvgH() {
    downloadSvg("row", Number(sizeInputH.value));
  }

  // 生成英文 SVG <g> 元素
  // maskFill 非空时用统一 mask 色（挖空模式），为 null 时每行独立 fill
  function englishSvg(texts, maskFill) {
    let s = '<g font-family="' + EN_FONT_NAME + '"';
    if (maskFill) s += ' fill="' + maskFill + '"';
    s += ">";
    texts.forEach(function (t) {
      const fillAttr = maskFill ? "" : ' fill="' + t.color + '"';
      s += '<text x="' + t.x.toFixed(2) + '" y="' + t.y.toFixed(2) +
        '" font-size="' + t.font.toFixed(2) + '" text-anchor="middle"' + fillAttr +
        ">" + esc(t.text) + "</text>";
    });
    return s + "</g>";
  }

  // 生成小字 SVG <text> 元素（dominant-baseline=hanging 对应 canvas textBaseline=top）
  function smallTextSvg(p, fill) {
    if (!p.smallOn) return "";
    return '<text x="' + p.smallDrawX.toFixed(2) + '" y="' + p.smallDrawY.toFixed(2) +
      '" font-family="' + SMALL_FONT_NAME + '" font-size="' + p.smallSizePx.toFixed(2) +
      '" fill="' + fill + '" dominant-baseline="hanging">' + esc(p.smallText) + "</text>";
  }

  // 下载 SVG Blob（suffix 用于区分横排 _h）
  function downloadSvgBlob(svg, mode, suffix) {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=UTF-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = getCharName() + "_" + mode + (suffix || "") + ".svg";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* === 英文行管理 === */

  function makeLabeled(labelText, input) {
    const wrap = document.createElement("div");
    wrap.className = "labeled";
    const lbl = document.createElement("span");
    lbl.className = "mini-label";
    lbl.textContent = labelText;
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    return wrap;
  }

  function addEnLine(text, size) {
    const row = document.createElement("div");
    row.className = "en-line";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "en-line-input";
    input.value = text || "";
    input.placeholder = "英文（单行）";
    input.addEventListener("input", renderPreview);

    const lineSizeInput = document.createElement("input");
    lineSizeInput.type = "number";
    lineSizeInput.min = "10";
    lineSizeInput.max = "500";
    lineSizeInput.step = "5";
    lineSizeInput.value = size != null ? size : 100;
    lineSizeInput.className = "en-line-size";
    lineSizeInput.title = "该行字号（占方块百分比）";
    lineSizeInput.addEventListener("input", renderPreview);

    const xInput = document.createElement("input");
    xInput.type = "number";
    xInput.min = "-500";
    xInput.max = "500";
    xInput.step = "1";
    xInput.value = "0";
    xInput.className = "en-line-x";
    xInput.title = "该行横坐标偏移（像素）";
    xInput.addEventListener("input", renderPreview);

    const yInput = document.createElement("input");
    yInput.type = "number";
    yInput.min = "-500";
    yInput.max = "500";
    yInput.step = "1";
    yInput.value = "0";
    yInput.className = "en-line-y";
    yInput.title = "该行纵坐标偏移（像素）";
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

  function getEnLines() {
    return Array.prototype.map.call(enLineList.querySelectorAll(".en-line"), function (row) {
      return {
        text: row.querySelector(".en-line-input").value,
        size: Number(row.querySelector(".en-line-size").value) || 100,
        x: Number(row.querySelector(".en-line-x").value) || 0,
        y: Number(row.querySelector(".en-line-y").value) || 0,
      };
    });
  }

  /* === 事件绑定 === */

  addEnBtn.addEventListener("click", function () {
    addEnLine("", 100);
    renderPreview();
  });
  [enGlobalSize, enGlobalX, enGlobalY, enLineSpacing].forEach(function (el) {
    el.addEventListener("input", renderPreview);
  });
  // 自动对齐开关：开启时保存字号快照，关闭时恢复
  // 快照变量封入闭包；initEnAlignSnapshot 在 addEnLine 之后调用（此时 DOM 才存在）
  let initEnAlignSnapshot;
  (function () {
    let snapshot = null;
    enAutoAlign.addEventListener("change", function () {
      const sizeInputs = enLineList.querySelectorAll(".en-line-size");
      if (enAutoAlign.checked) {
        // 开启：保存当前字号快照
        snapshot = Array.prototype.map.call(sizeInputs, function (inp) { return inp.value; });
      } else {
        // 关闭：恢复快照
        if (snapshot) {
          sizeInputs.forEach(function (inp, i) {
            if (snapshot[i] != null) inp.value = snapshot[i];
          });
          snapshot = null;
        }
      }
      renderPreview();
    });
    initEnAlignSnapshot = function () {
      if (enAutoAlign.checked) {
        const sizeInputs0 = enLineList.querySelectorAll(".en-line-size");
        snapshot = Array.prototype.map.call(sizeInputs0, function (inp) { return inp.value; });
      }
    };
  })();

  // 汉字输入：检测字符变化时自动调整字号
  let lastChars = [char1.value, char2.value, char3.value];
  [char1, char2, char3].forEach(function (el, i) {
    el.addEventListener("input", function () {
      const newChar = el.value.slice(0, 1);
      if (newChar !== lastChars[i]) {
        lastChars[i] = newChar;
        autoFit(i);
      }
      renderPreview();
    });
  });
  [size1, size2, size3].forEach(function (el) { el.addEventListener("input", renderPreview); });
  [x1, y1, x2, y2, x3, y3].forEach(function (el) { el.addEventListener("input", renderPreview); });
  [cnGlobalSize, cnGlobalX, cnGlobalY].forEach(function (el) { el.addEventListener("input", renderPreview); });
  // size 变化后重新计算偏移，确保各尺寸下字符仍紧贴格子边缘
  // autoFitAll 涉及像素扫描开销较大，加 200ms debounce；renderPreview 即时反馈
  let sizeInputTimer = null;
  sizeInput.addEventListener("input", function () {
    renderPreview();
    clearTimeout(sizeInputTimer);
    sizeInputTimer = setTimeout(function () {
      autoFitAll();
      renderPreview();
    }, 200);
  });

  sizeInputH.addEventListener("input", renderPreview);

  // 样式切换
  modeInputs.forEach(function (el) {
    el.addEventListener("change", function () {
      currentMode = el.value;
      // 切换到自定义模式时，以上一个非自定义模式默认色作为起点
      if (el.value === "custom") {
        syncColorsFromMode(lastNonCustomMode);
      } else {
        lastNonCustomMode = el.value;
      }
      updateCustomPanelState();
      renderPreview();
    });
  });

  downloadBtn.addEventListener("click", download);
  downloadSvgBtn.addEventListener("click", function () { downloadSvg("grid"); });
  downloadHBtn.addEventListener("click", downloadH);
  downloadHSvgBtn.addEventListener("click", downloadSvgH);

  // 自定义颜色面板事件
  [color1, color2, color3, bgColor, blockColorInput].forEach(function (el) {
    el.addEventListener("input", renderPreview);
  });
  [color1Alpha, color2Alpha, color3Alpha, bgColorAlpha, blockColorAlpha].forEach(function (el) {
    el.addEventListener("input", renderPreview);
  });

  // 自定义图片事件
  customImageUpload.addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      const img = new Image();
      img.onload = function () {
        customImage = img;
        renderPreview();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
  customImageEnabled.addEventListener("change", function () {
    updateCustomImageState();
    renderPreview();
  });
  [textTransparentRadio, bgImageTransparentRadio].forEach(function (el) {
    el.addEventListener("change", renderPreview);
  });

  // 小字板块事件
  smallEnabled.addEventListener("change", function () {
    updateSmallPanelState();
    renderPreview();
  });
  [smallText, smallSize, smallX, smallY, smallColor, smallColorAlpha].forEach(function (el) {
    el.addEventListener("input", renderPreview);
  });

  /* === 更新日志抽屉 === */
  (function () {
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
  })();

  /* === 加载页（Endfield 风格） === */
  // 优化：字体就绪后立即推进到 100%，RAF 达到 100 后停止
  (function initLoadingCover() {
    const cover = document.getElementById("loading-cover");
    if (!cover) return;
    document.body.style.overflow = "hidden";

    // 终结技语音 - 随机展示一句（数据来源：终末地干员终结技中文语音）
    const ultQuotes = [
      "多利先生，帮帮忙吧！",
      "多利先生，别跑太远。",
      "多利先生，下手轻一些。",
      "音爆……轰击！",
      "汇聚……释放！",
      "将声音凝结！",
      "我可不算温柔！",
      "这是一条噩耗！",
      "掣击，决颤！",
      "上钩了！",
      "你才是饵料！",
      "去饱餐一顿吧！",
      "去吧，制胜关键。",
      "增幅回路，启动。",
      "动力运行。",
      "最大功率，启动！",
      "这里就是终点！",
      "请、请和世界告别吧！",
      "当破即破！",
      "当断即断！",
      "当弃即弃！",
      "猛火快炒！",
      "尝尝我的手艺！",
      "让你挑食！",
      "没有第二次机会。",
      "你将迈向终结。",
      "闹剧该结束了！",
      "避无可避。",
      "从风暴中来。",
      "瞬息而至。",
      "世界翻转！",
      "感受大地的力量！",
      "倾倒在重力之下吧！",
      "听我号令！",
      "随我进军！",
      "盾卫！列阵！",
      "我来解决你们！",
      "不会让你过去的！",
      "滚开！",
      "火焰，照亮黄昏！",
      "焚烧黑暗！",
      "你的末日到了！",
      "猎物，一个不留！",
      "撕咬吧！",
      "群狼，围猎！",
      "猜猜在哪只手？",
      "摧破业障，降伏诸恶！",
      "现忿怒相，破！",
      "蒸腾吧，群狼之血！",
      "我是利刃的化身！",
      "群狼之魂，与我同在。",
      "我来掀桌子！",
      "统统……逮捕！",
      "敬酒不吃吃罚酒！",
      "歼灭坐标，权限七！",
      "目标锁定，开火！",
      "帝江号，清空区域！",
      "看我的信号！",
      "焰火表演开始！",
      "决胜行动方案——",
      "逻辑，本不宜人。",
      "清除此等不谐！",
      "细数他们的罪行。",
      "看见你了——",
      "这招叫——站住别跑！",
      "随波而逝吧！",
      "来，一起跳个舞吧！",
      '感受我"超载的热情"吧！',
      "送你一场烟花秀！",
      "都活得够久了吧？",
      "动静会有点大哦。",
      "现在还想逃跑吗？",
      "守誓之焰！",
      "我将照耀！",
      "光明于此延续！",
      "凛冽寒风！",
      "冰晶之盾！",
      "在霜寒前，停下！",
      "惊霆无声，流电掣雨。",
      "雷雨并作，化育万物。",
      "青霄碧落，乌云尽扫。",
      "猩红之雨啊……",
      "坠入永夜吧。",
      "罪行，终被焚毁。",
      "盈缺复转，以我为阵！",
      "天地三才，我衔人间。",
      "平山海，定风波！"
    ];
    const quoteEl = cover.querySelector("#loading-quote");
    if (quoteEl) {
      quoteEl.textContent = ultQuotes[Math.floor(Math.random() * ultQuotes.length)];
    }

    const percentEl = cover.querySelector(".progress-percent");
    const statusEl = cover.querySelector(".status-text");
    // 阶段流转：init -> loading -> complete -> sweeping -> fadeout
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
    // 800ms 后推进到 90%；字体就绪（Promise）后推进到 100%
    setTimeout(function () { if (target < 90) target = 90; }, 800);
    fontsReadyPromise.then(function () { target = 100; });

    // RAF 动画：display 追赶 target；达到 100 后直接触发阶段流转（取代 setInterval 轮询）
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

    // 页脚终结技轮播：随机展示一句，每 5 秒直接切换（不闪烁）
    function startFooterQuote() {
      const el = document.getElementById("footerQuote");
      if (!el) return;
      let last = -1;
      function pick() {
        if (ultQuotes.length <= 1) return ultQuotes[0];
        let i;
        do { i = Math.floor(Math.random() * ultQuotes.length); }
        while (i === last);
        last = i;
        return ultQuotes[i];
      }
      el.textContent = pick();
      setInterval(function () {
        el.textContent = pick();
      }, 5000);
    }
  })();

  /* === 初始化 === */
  loadFonts();
  addEnLine("ARKNIGHTS", 100);
  addEnLine("ENDFIELD", 100);
  // 初始默认开启自动对齐时保存字号快照，供关闭时恢复
  initEnAlignSnapshot();
  updateCustomPanelState();
  updateSmallPanelState();
})();
