/* ============================================
   渲染器 — Canvas/SVG 绘制与下载逻辑
   dom 和 state 由 main.js 填充
   ============================================ */

import {
  FONT_NAME, FONT_URL, EN_FONT_NAME, EN_FONT_URL,
  SMALL_FONT_NAME, SMALL_FONT_URL, MODES,
} from "./constants.js";
import { withAlpha, esc, arrayBufferToBase64 } from "./utils.js";

/* === 共享对象（由 main.js 填充） === */
export const dom = {};
export const state = {
  fontReady: false,
  enFontReady: false,
  smallFontReady: false,
  currentMode: "black",
  customImage: null,
  lastNonCustomMode: "black",
};

/* === 字体就绪 Promise（main.js 等待） === */
let fontsReadyResolve = null;
export const fontsReadyPromise = new Promise(function (r) { fontsReadyResolve = r; });

/* === 渲染器内部状态 === */
let currentCtx = null;
let rafId = null;
const base64Cache = {};

/* === 工具：从 DOM 读取状态 === */

function getMode() {
  return state.currentMode;
}

function isCustomEnabled() {
  return getMode() === "custom";
}

function isSmallEnabled() {
  return dom.smallEnabled.checked;
}

function isCustomImageEnabled() {
  return isCustomEnabled() && dom.customImageEnabled.checked && !!state.customImage;
}

function getImageMode() {
  return dom.textTransparent.checked ? "textTransparent" : "bgTransparent";
}

function getEnLines() {
  return Array.prototype.map.call(dom.enLineList.querySelectorAll(".en-line"), function (row) {
    return {
      text: row.querySelector(".en-line-input").value,
      size: Number(row.querySelector(".en-line-size").value) || 100,
      x: Number(row.querySelector(".en-line-x").value) || 0,
      y: Number(row.querySelector(".en-line-y").value) || 0,
    };
  });
}

/* === 字体加载 === */

async function loadFonts() {
  // 初始化 currentCtx（autoFitAll 在字体加载后立即调用，需要 ctx 做像素扫描）
  currentCtx = dom.ctx;
  const cnFace = new FontFace(FONT_NAME, "url(" + FONT_URL + ")");
  const enFace = new FontFace(EN_FONT_NAME, "url(" + EN_FONT_URL + ")");

  const [cnLoad, enLoad] = await Promise.allSettled([
    cnFace.load(),
    enFace.load(),
  ]);

  if (cnLoad.status === "fulfilled") {
    document.fonts.add(cnFace);
    state.fontReady = true;
  } else {
    console.error("中文字体加载失败:", cnLoad.reason);
  }

  if (enLoad.status === "fulfilled") {
    document.fonts.add(enFace);
    state.enFontReady = true;
    state.smallFontReady = true;
  } else {
    console.error("英文字体加载失败:", enLoad.reason);
  }

  if (fontsReadyResolve) fontsReadyResolve();
  autoFitAll();
  renderPreview();
}

// SVG 导出用：惰性获取字体 Base64（结果缓存复用）
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
function calcGlyphMetrics(cellSize, char, scale) {
  currentCtx.textAlign = "left";
  currentCtx.textBaseline = "alphabetic";
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

function drawGlyph(x, y, cellSize, char, scale) {
  if (!char) return;
  const g = calcGlyphMetrics(cellSize, char, scale);
  currentCtx.fillText(char, x + g.drawX, y + g.drawY);
}

function glyphSvg(x, y, cellSize, char, scale, fill) {
  if (!char) return "";
  const g = calcGlyphMetrics(cellSize, char, scale);
  return '<text x="' + (x + g.drawX).toFixed(2) + '" y="' + (y + g.drawY).toFixed(2) +
    '" font-family="' + FONT_NAME + '" font-size="' + g.font.toFixed(2) +
    '" fill="' + fill + '">' + esc(char) + "</text>";
}

/* === 像素扫描（自动调整字号用） === */

function makeScanPixels(ch, cellSize, pad) {
  if (!ch) return null;
  currentCtx.textAlign = "left";
  currentCtx.textBaseline = "alphabetic";
  currentCtx.font = cellSize + "px " + FONT_NAME;
  const m = currentCtx.measureText(ch);
  const inkW = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) || cellSize;

  return function scanPixels(scale) {
    const s = cellSize * (cellSize / inkW) * scale;
    currentCtx.textAlign = "left";
    currentCtx.textBaseline = "alphabetic";
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

function autoFitChar(index) {
  if (!state.fontReady) return;
  const inputs = [
    { char: dom.char1, x: dom.x1, y: dom.y1, size: dom.size1 },
    { char: dom.char2, x: dom.x2, y: dom.y2, size: dom.size2 },
    { char: dom.char3, x: dom.x3, y: dom.y3, size: dom.size3 },
  ];
  const inp = inputs[index];
  const ch = inp.char.value.slice(0, 1);
  if (!ch) return;

  const renderSize = Math.min(Math.max(Math.round(Number(dom.sizeInput.value) || 512), 64), 4096);
  const cellSize = renderSize / 2;
  const offScale = renderSize / 512;
  const pad = Math.ceil(cellSize * 0.234);
  const target = cellSize + 2;
  const scanPixels = makeScanPixels(ch, cellSize, pad);

  let scale = (Number(inp.size.value) || 100) / 100;
  for (let iter = 0; iter < 10; iter++) {
    const r = scanPixels(scale);
    if (!r) return;
    scale *= Math.min(target / r.actW, target / r.actH);
  }

  inp.size.value = Math.round(scale * 100) + 1;
  const r = scanPixels(scale);
  if (!r) return;

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

  inp.x.value = Math.round(offsetX / offScale);
  inp.y.value = Math.round(offsetY / offScale);
}

function autoFitAll() {
  autoFitChar(0);
  autoFitChar(1);
  autoFitChar(2);
}

/* === 颜色解析 === */

/**
 * 解析当前模式下的全部绘制颜色与策略标记
 * 注意：返回值同时携带颜色（charColors/enColors/blockColor/smallColor）和绘制策略（enKnockout），
 * enKnockout 表示"英文是否镂空（destination-out）"，非颜色属性，此处合并返回以简化 drawTo 调用。
 */
function resolveColors(mode) {
  const m = MODES[mode];
  const enabled = isCustomEnabled();
  const charColors = enabled
    ? [
        withAlpha(dom.color1.value, dom.color1Alpha.value),
        withAlpha(dom.color2.value, dom.color2Alpha.value),
        withAlpha(dom.color3.value, dom.color3Alpha.value),
      ]
    : [m.fg, m.fg, m.fg];
  let bg;
  if (enabled) {
    const bgA = Math.max(0, Math.min(100, Number(dom.bgColorAlpha.value) || 100)) / 100;
    bg = bgA <= 0 ? null : withAlpha(dom.bgColor.value, dom.bgColorAlpha.value);
  } else {
    bg = m.bg;
  }
  const blockColor = enabled ? withAlpha(dom.blockColor.value, dom.blockColorAlpha.value) : m.fg;
  const enColor = bg ? bg : blockColor;
  const enColors = getEnLines().map(function () { return enColor; });
  const enKnockout = (mode === "transparent" || mode === "transparent_black") || enabled;
  const smallColorVal = enabled ? withAlpha(dom.smallColor.value, dom.smallColorAlpha.value) : m.fg;
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

/* === 图片绘制 === */

function drawImageCover(img, w, h) {
  const ratio = Math.max(w / img.width, h / img.height);
  const iw = img.width * ratio;
  const ih = img.height * ratio;
  currentCtx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

/* === 英文换行与绘制 === */

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

/**
 * 计算英文行的布局（字号、换行、垂直堆叠坐标）
 * 注意：此函数有副作用——当 dom.enAutoAlign.checked 时，会把自动对齐算出的新字号
 * 写回对应 .en-line-size 输入框（让用户看到对齐后的值）。布局计算与 DOM 写入耦合在此，
 * 拆分会增加多调用方的协调成本，故保留并用注释标注。
 */
function calcEnglishBlocks(p, colors) {
  const allLines = getEnLines();
  const lines = [];
  allLines.forEach(function (l, i) {
    if (l.text.trim()) {
      lines.push({
        text: l.text, size: l.size, x: l.x, y: l.y,
        color: colors.enColors[i] != null ? colors.enColors[i] : "#000000",
        srcIndex: i,
      });
    }
  });
  if (!state.enFontReady || !lines.length) return [];

  const cell = p.cell;
  const pad = cell * 0.06;
  const maxW = cell - pad * 2;
  const centerX = p.centerX;
  const last = lines.length - 1;
  const offScale = p.offScale;
  const lineSpacing = Number(dom.enLineSpacing.value) || 0.85;
  const globalSize = (Number(dom.enGlobalSize.value) || 100) / 100;
  const globalX = (Number(dom.enGlobalX.value) || 0) * offScale;
  const globalY = (Number(dom.enGlobalY.value) || 0) * offScale;

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

  if (dom.enAutoAlign.checked) {
    blocks.forEach(function (b) {
      currentCtx.font = b.font + "px " + EN_FONT_NAME;
      b.widest = b.lines.reduce(function (mx, s) {
        return Math.max(mx, currentCtx.measureText(s).width);
      }, 0);
    });
    const targetW = blocks.reduce(function (mx, b) {
      return Math.max(mx, b.widest);
    }, 0);
    const sizeInputs = dom.enLineList.querySelectorAll(".en-line-size");
    blocks.forEach(function (b) {
      if (b.widest > 0 && b.widest < targetW) {
        const ratio = targetW / b.widest;
        b.font *= ratio;
        const newSize = Math.round(b.srcSize * ratio);
        const input = sizeInputs[b.srcIndex];
        if (input && Number(input.value) !== newSize) {
          input.value = newSize;
        }
      }
    });
  }

  const totalRaw = blocks.reduce(function (s, b) {
    return s + b.lines.length * b.font * lineSpacing;
  }, 0);
  const lastH = blocks[last].lines.length * blocks[last].font * lineSpacing;
  const restH = totalRaw - lastH;
  let factor = 1;
  if (restH > 0 && totalRaw > cell - pad) {
    factor = Math.max((cell - pad - lastH) / restH, 0);
  }

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

/**
 * 绘制英文行
 * @param {Object} p - 绘制参数
 * @param {Object} colors - resolveColors 返回的颜色对象
 * @param {boolean} [knockout] - 是否镂空（true=挖空矩形露出下层，省略则取 colors.enKnockout）
 */
function drawEnglish(p, colors, knockout) {
  const texts = calcEnglishBlocks(p, colors);
  if (!texts.length) return;
  if (knockout == null) knockout = colors.enKnockout;

  currentCtx.textAlign = "center";
  currentCtx.textBaseline = "alphabetic";
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

/* === 绘制参数解析 === */

function getDrawParams(layout, sizeOverride) {
  const rawSize = sizeOverride != null ? sizeOverride : Number(dom.sizeInput.value);
  const size = Math.min(Math.max(Math.round(rawSize || 512), 64), 4096);
  const cell = size / 2;
  const offScale = size / 512;
  const chars = [dom.char1.value.slice(0, 1), dom.char2.value.slice(0, 1), dom.char3.value.slice(0, 1)];
  const scales = [
    (Number(dom.size1.value) || 100) / 100,
    (Number(dom.size2.value) || 100) / 100,
    (Number(dom.size3.value) || 100) / 100,
  ];
  const cnGlobalScale = (Number(dom.cnGlobalSize.value) || 100) / 100;
  const offsets = [
    [(Number(dom.x1.value) || 0) * offScale, (Number(dom.y1.value) || 0) * offScale],
    [(Number(dom.x2.value) || 0) * offScale, (Number(dom.y2.value) || 0) * offScale],
    [(Number(dom.x3.value) || 0) * offScale, (Number(dom.y3.value) || 0) * offScale],
  ];
  const cnOffX = (Number(dom.cnGlobalX.value) || 0) * offScale;
  const cnOffY = (Number(dom.cnGlobalY.value) || 0) * offScale;

  let canvasW, canvasH, positions, blockX, blockY, centerX, yBase;
  const pad = cell * 0.06;
  if (layout === "row") {
    canvasW = size * 2;
    canvasH = cell;
    const gy = 0;
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

  const smallOn = isSmallEnabled() && state.smallFontReady && dom.smallText.value.trim();
  let smallH = 0;
  let smallSizePx = 0;
  let smallDrawX = 0;
  let smallDrawY = 0;
  if (smallOn) {
    smallSizePx = cell * (Number(dom.smallSize.value) || 24) / 100;
    const gap = smallSizePx * 0.03;
    smallH = smallSizePx + gap;
    canvasH += smallH;
    positions = positions.map(function (pos) { return [pos[0], pos[1] + smallH]; });
    blockY += smallH;
    yBase += smallH;
    smallDrawX = positions[0][0] + (Number(dom.smallX.value) || 0) * offScale;
    smallDrawY = positions[0][1] - gap - smallSizePx + (Number(dom.smallY.value) || 0) * offScale;
  }

  return {
    layout: layout, size: size, canvasW: canvasW, canvasH: canvasH,
    cell: cell, offScale: offScale, chars: chars,
    positions: positions, scales: scales, cnGlobalScale: cnGlobalScale,
    offsets: offsets, cnOffX: cnOffX, cnOffY: cnOffY,
    blockX: blockX, blockY: blockY, blockW: cell, blockH: cell,
    centerX: centerX, yBase: yBase,
    smallOn: smallOn, smallText: smallOn ? dom.smallText.value : "",
    smallSizePx: smallSizePx, smallDrawX: smallDrawX, smallDrawY: smallDrawY,
  };
}

/**
 * 绘制三个汉字（统一入口，消除普通模式与自定义图片模式的位置计算重复）
 * @param {Object} p - getDrawParams 返回的参数对象
 * @param {Array} fillStyles - 每个字符的 fillStyle（颜色字符串或 pattern），长度需 ≥ chars.length
 */
function drawChars(p, fillStyles) {
  currentCtx.textBaseline = "alphabetic";
  p.chars.forEach(function (ch, i) {
    currentCtx.fillStyle = fillStyles[i];
    drawGlyph(
      p.positions[i][0] + p.offsets[i][0] + p.cnOffX,
      p.positions[i][1] + p.offsets[i][1] + p.cnOffY,
      p.cell, ch, p.scales[i] * p.cnGlobalScale
    );
  });
}

function drawSmallText(p, fillStyle) {
  if (!p.smallOn) return;
  currentCtx.font = p.smallSizePx + "px " + SMALL_FONT_NAME;
  currentCtx.fillStyle = fillStyle;
  currentCtx.textAlign = "left";
  currentCtx.textBaseline = "top";
  currentCtx.fillText(p.smallText, p.smallDrawX, p.smallDrawY);
}

/* === 核心绘制 === */

function drawTo(targetCtx, p, colors) {
  currentCtx = targetCtx;
  const targetCanvas = targetCtx.canvas;
  targetCanvas.width = p.canvasW;
  targetCanvas.height = p.canvasH;

  /* --- 自定义图片模式：英文始终镂空（局部变量，不污染入参 colors） --- */
  if (isCustomImageEnabled()) {
    const imgMode = getImageMode();
    if (imgMode === "textTransparent") {
      drawImageCover(state.customImage, p.canvasW, p.canvasH);
      currentCtx.globalCompositeOperation = "destination-out";
      drawChars(p, ["#ffffff", "#ffffff", "#ffffff"]);
      drawSmallText(p, "#ffffff");
      currentCtx.globalCompositeOperation = "source-over";
      drawEnglish(p, colors, true);
    } else {
      currentCtx.clearRect(0, 0, p.canvasW, p.canvasH);
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = p.canvasW;
      tmpCanvas.height = p.canvasH;
      const tmpCtx = tmpCanvas.getContext("2d");
      const ratio = Math.max(p.canvasW / state.customImage.width, p.canvasH / state.customImage.height);
      const iw = state.customImage.width * ratio;
      const ih = state.customImage.height * ratio;
      tmpCtx.drawImage(state.customImage, (p.canvasW - iw) / 2, (p.canvasH - ih) / 2, iw, ih);
      const pattern = currentCtx.createPattern(tmpCanvas, "no-repeat");
      drawChars(p, [pattern, pattern, pattern]);
      drawSmallText(p, pattern);
      currentCtx.fillStyle = pattern;
      currentCtx.fillRect(p.blockX, p.blockY, p.blockW, p.blockH);
      drawEnglish(p, colors, true);
    }
    return;
  }

  /* --- 普通模式 --- */
  currentCtx.clearRect(0, 0, p.canvasW, p.canvasH);
  if (colors.bg) {
    currentCtx.fillStyle = colors.bg;
    currentCtx.fillRect(0, 0, p.canvasW, p.canvasH);
  }

  drawSmallText(p, colors.smallColor);
  drawChars(p, colors.charColors);

  if (colors.enKnockout) {
    // 镂空：先在临时画布画矩形+英文（destination-out 挖空英文），再叠加到主画布
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = p.canvasW;
    tmpCanvas.height = p.canvasH;
    const tmpCtx = tmpCanvas.getContext("2d");
    tmpCtx.fillStyle = colors.blockColor;
    tmpCtx.fillRect(p.blockX, p.blockY, p.blockW, p.blockH);
    const savedCtx = currentCtx;
    currentCtx = tmpCtx;
    drawEnglish(p, colors, true);
    currentCtx = savedCtx;
    currentCtx.drawImage(tmpCanvas, 0, 0);
  } else {
    currentCtx.fillStyle = colors.blockColor;
    currentCtx.fillRect(p.blockX, p.blockY, p.blockW, p.blockH);
    drawEnglish(p, colors, false);
  }
}

function draw(mode) {
  drawTo(dom.ctx, getDrawParams("grid"), resolveColors(mode));
}

function drawH(mode) {
  drawTo(dom.ctxH, getDrawParams("row", Number(dom.sizeInputH.value)), resolveColors(mode));
}

/* === 预览渲染（RAF 节流） === */

export function renderPreview() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(function () {
    rafId = null;
    const mode = getMode();
    draw(mode);
    drawH(mode);
  });
}

/* === 下载 === */

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

function getCharName() {
  const c1 = dom.char1.value.slice(0, 1) || "_";
  const c2 = dom.char2.value.slice(0, 1) || "_";
  const c3 = dom.char3.value.slice(0, 1) || "_";
  return c1 + c2 + c3;
}

export function download() {
  downloadBlobTo(dom.canvas, getDrawParams("grid"), getMode(), getCharName() + "_" + getMode() + ".png");
}

export function downloadH() {
  downloadBlobTo(dom.canvasH, getDrawParams("row", Number(dom.sizeInputH.value)), getMode(), getCharName() + "_" + getMode() + "_h.png");
}

/* === SVG 生成 === */

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

function smallTextSvg(p, fill) {
  if (!p.smallOn) return "";
  return '<text x="' + p.smallDrawX.toFixed(2) + '" y="' + p.smallDrawY.toFixed(2) +
    '" font-family="' + SMALL_FONT_NAME + '" font-size="' + p.smallSizePx.toFixed(2) +
    '" fill="' + fill + '" dominant-baseline="hanging">' + esc(p.smallText) + "</text>";
}

function downloadSvgBlob(svg, mode, suffix) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=UTF-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = getCharName() + "_" + mode + (suffix || "") + ".svg";
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function downloadSvg(layout, sizeOverride) {
  const mode = getMode();
  const colors = resolveColors(mode);
  const p = getDrawParams(layout, sizeOverride);
  const knockout = colors.enKnockout;
  const englishTexts = calcEnglishBlocks(p, colors);
  const w = p.canvasW, h = p.canvasH;
  const suffix = layout === "row" ? "_h" : "";

  let svg = '<?xml version="1.0" encoding="UTF-8"?>';
  svg += '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '">';

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

  /* --- 自定义图片模式 --- */
  if (isCustomImageEnabled()) {
    const tmpC = document.createElement("canvas");
    tmpC.width = w;
    tmpC.height = h;
    const tmpCx = tmpC.getContext("2d");
    const ir = Math.max(w / state.customImage.width, h / state.customImage.height);
    const iw = state.customImage.width * ir;
    const ih = state.customImage.height * ir;
    tmpCx.drawImage(state.customImage, (w - iw) / 2, (h - ih) / 2, iw, ih);
    const imgDataUrl = tmpC.toDataURL("image/png");
    const imgMode = getImageMode();

    if (imgMode === "textTransparent") {
      svg += '<defs><mask id="imgTextMask">';
      svg += '<rect width="' + w + '" height="' + h + '" fill="white"/>';
      if (state.fontReady) {
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
      svg += '<defs><pattern id="imgPattern" width="' + w + '" height="' + h + '" patternUnits="userSpaceOnUse">';
      svg += '<image href="' + imgDataUrl + '" width="' + w + '" height="' + h + '"/>';
      svg += "</pattern></defs>";
      if (state.fontReady) {
        p.chars.forEach(function (ch, i) {
          svg += glyphSvg(
            p.positions[i][0] + p.offsets[i][0] + p.cnOffX,
            p.positions[i][1] + p.offsets[i][1] + p.cnOffY,
            p.cell, ch, p.scales[i] * p.cnGlobalScale, "url(#imgPattern)"
          );
        });
      }
      svg += smallTextSvg(p, "url(#imgPattern)");
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

  svg += smallTextSvg(p, colors.smallColor);

  if (state.fontReady) {
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

  if (knockout) {
    svg += '<defs><mask id="blockMask">';
    svg += '<rect x="' + p.blockX + '" y="' + p.blockY + '" width="' + p.blockW + '" height="' + p.blockH + '" fill="white"/>';
    svg += englishSvg(englishTexts, "#000000");
    svg += "</mask></defs>";
    svg += '<rect x="' + p.blockX + '" y="' + p.blockY + '" width="' + p.blockW + '" height="' + p.blockH + '" fill="' + colors.blockColor + '" mask="url(#blockMask)"/>';
  } else {
    svg += '<rect x="' + p.blockX + '" y="' + p.blockY + '" width="' + p.blockW + '" height="' + p.blockH + '" fill="' + colors.blockColor + '"/>';
    svg += englishSvg(englishTexts, null);
  }

  svg += "</svg>";
  downloadSvgBlob(svg, mode, suffix);
}

export function downloadSvgH() {
  downloadSvg("row", Number(dom.sizeInputH.value));
}

/* === 导出（供 main.js 调用） === */
export { loadFonts, autoFitChar, autoFitAll };
