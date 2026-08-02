/* ============================================
   工具函数（纯函数，无副作用）
   ============================================ */

/**
 * hex + 透明度百分比 -> rgba 字符串
 * 透明度 100% 时返回原 hex
 * 注意：0 是合法透明度值，不能用 || 兜底（0 || 100 会变 100）
 */
export function withAlpha(hex, alphaPercent) {
  const num = Number(alphaPercent);
  const a = Math.max(0, Math.min(100, isNaN(num) ? 100 : num)) / 100;
  if (a >= 1) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
}

/**
 * ArrayBuffer 转 Base64（分块处理避免栈溢出）
 */
export function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * SVG 文本转义
 */
export function esc(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 创建带标签的输入容器
 * <div class="labeled"><span class="mini-label">{labelText}</span>{input}</div>
 */
export function makeLabeled(labelText, input) {
  const wrap = document.createElement("div");
  wrap.className = "labeled";
  const lbl = document.createElement("span");
  lbl.className = "mini-label";
  lbl.textContent = labelText;
  wrap.appendChild(lbl);
  wrap.appendChild(input);
  return wrap;
}

/**
 * 创建 number input 元素
 * @param {Object} opts - { id, min, max, step, value, title, className }
 */
export function createNumberInput(opts) {
  const input = document.createElement("input");
  input.type = "number";
  if (opts.id) input.id = opts.id;
  if (opts.min != null) input.min = String(opts.min);
  if (opts.max != null) input.max = String(opts.max);
  if (opts.step != null) input.step = String(opts.step);
  if (opts.value != null) input.value = opts.value;
  if (opts.title) input.title = opts.title;
  if (opts.className) input.className = opts.className;
  return input;
}
