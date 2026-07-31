(function () {
  const FONT_NAME = "EndfieldFont";
  const FONT_URL = "fonts/font.ttf";
  const EN_FONT_NAME = "GilroyBlack";
  const EN_FONT_URL = "fonts/gilroy-black-6.otf";

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

    const sizeInput = document.createElement("input");
    sizeInput.type = "number";
    sizeInput.min = "10";
    sizeInput.max = "500";
    sizeInput.step = "5";
    sizeInput.value = size != null ? size : 100;
    sizeInput.className = "en-line-size";
    sizeInput.title = "该行字号（占方块百分比）";
    sizeInput.addEventListener("input", renderPreview);

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
    opts.appendChild(makeLabeled("字号", sizeInput));
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
  const sizeInput = document.getElementById("sizeInput");
  const downloadBtn = document.getElementById("downloadBtn");
  const downloadAllBtn = document.getElementById("downloadAllBtn");
  const modeInputs = document.querySelectorAll('input[name="bgMode"]');
  const canvas = document.getElementById("preview");

  const ctx = canvas.getContext("2d");

  let fontReady = false;
  let enFontReady = false;

  async function loadFonts() {
    const [cnResult, enResult] = await Promise.allSettled([
      new FontFace(FONT_NAME, `url(${FONT_URL})`).load(),
      new FontFace(EN_FONT_NAME, `url(${EN_FONT_URL})`).load(),
    ]);
    if (cnResult.status === "fulfilled") {
      document.fonts.add(cnResult.value);
      fontReady = true;
    } else {
      console.error("字体加载失败:", cnResult.reason);
    }
    if (enResult.status === "fulfilled") {
      document.fonts.add(enResult.value);
      enFontReady = true;
    } else {
      console.error("英文字体加载失败:", enResult.reason);
    }
    renderPreview();
  }

  function drawGlyph(x, y, cellSize, char, scale) {
    if (!char) return;
    ctx.font = `${cellSize}px ${FONT_NAME}`;
    const m = ctx.measureText(char);
    const inkW = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) || cellSize;
    const s = cellSize * (cellSize / inkW) * scale;
    ctx.font = `${s}px ${FONT_NAME}`;
    const sm = ctx.measureText(char);
    const sw = sm.actualBoundingBoxLeft + sm.actualBoundingBoxRight;
    const sh = sm.actualBoundingBoxAscent + sm.actualBoundingBoxDescent;
    ctx.fillText(
      char,
      x + (cellSize - sw) / 2 - sm.actualBoundingBoxLeft,
      y + (cellSize - sh) / 2 + sm.actualBoundingBoxAscent
    );
  }

  function getMode() {
    return document.querySelector('input[name="bgMode"]:checked').value;
  }

  const MODES = {
    black: { bg: "#000000", fg: "#ffffff", label: "黑底白字" },
    white: { bg: "#ffffff", fg: "#000000", label: "白底黑字" },
    transparent: { bg: null, fg: "#ffffff", label: "透明白字" },
    transparent_black: { bg: null, fg: "#000000", label: "透明黑字" },
  };

  function wrapText(text, maxWidth, fontSize) {
    ctx.font = `${fontSize}px ${EN_FONT_NAME}`;
    const lines = [];
    text.split("\n").forEach(function (para) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = "";
      words.forEach(function (w) {
        const t = line ? line + " " + w : w;
        if (!line || ctx.measureText(t).width <= maxWidth) {
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

  function drawEnglish(mode, size) {
    const lines = getEnLines().filter(function (l) {
      return l.text.trim();
    });
    if (!enFontReady || !lines.length) return;
    const cell = size / 2;
    const pad = cell * 0.06;
    const maxW = cell - pad * 2;
    const centerX = cell + cell / 2;
    const last = lines.length - 1;
    const offScale = size / 512;
    const lineSpacing = Number(enLineSpacing.value) || 0.85;
    const globalSize = (Number(enGlobalSize.value) || 100) / 100;
    const globalX = (Number(enGlobalX.value) || 0) * offScale;
    const globalY = (Number(enGlobalY.value) || 0) * offScale;

    const blocks = lines.map(function (l) {
      let fs = cell * 0.14 * (l.size / 100) * globalSize;
      let ls = wrapText(l.text, maxW, fs);
      while (fs > 4) {
        ctx.font = `${fs}px ${EN_FONT_NAME}`;
        const widest = ls.reduce(function (mx, s) {
          return Math.max(mx, ctx.measureText(s).width);
        }, 0);
        if (widest <= maxW) break;
        fs *= 0.92;
        ls = wrapText(l.text, maxW, fs);
      }
      return { lines: ls, font: fs, x: l.x * offScale, y: l.y * offScale };
    });

    const totalRaw = blocks.reduce(function (s, b) {
      return s + b.lines.length * b.font * lineSpacing;
    }, 0);
    const lastH = blocks[last].lines.length * blocks[last].font * lineSpacing;
    const restH = totalRaw - lastH;
    let factor = 1;
    if (restH > 0 && totalRaw > cell - pad) {
      factor = Math.max((cell - pad - lastH) / restH, 0);
    }
    ctx.textAlign = "center";
    const knockout = mode === "transparent" || mode === "transparent_black";
    if (knockout) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#ffffff";
    } else {
      ctx.fillStyle = mode === "black" ? "#000000" : "#ffffff";
    }
    let yBase = size - pad;
    for (let bi = blocks.length - 1; bi >= 0; bi--) {
      const b = blocks[bi];
      const f = bi === last ? 1 : factor;
      for (let li = b.lines.length - 1; li >= 0; li--) {
        ctx.font = `${b.font * f}px ${EN_FONT_NAME}`;
        ctx.fillText(b.lines[li], centerX + globalX + b.x, yBase + globalY + b.y);
        yBase -= b.font * f * lineSpacing;
      }
    }
    ctx.textAlign = "left";
    ctx.globalCompositeOperation = "source-over";
  }

  function draw(mode) {
    const m = MODES[mode];
    const size = Math.min(Math.max(Math.round(Number(sizeInput.value) || 512), 64), 4096);
    canvas.width = size;
    canvas.height = size;

    if (m.bg) {
      ctx.fillStyle = m.bg;
      ctx.fillRect(0, 0, size, size);
    } else {
      ctx.clearRect(0, 0, size, size);
    }

    const chars = [char1.value.slice(0, 1), char2.value.slice(0, 1), char3.value.slice(0, 1)];

    const cell = size / 2;

    const positions = [
      [0, 0],
      [cell, 0],
      [0, cell],
    ];

    const scales = [
      (Number(size1.value) || 100) / 100,
      (Number(size2.value) || 100) / 100,
      (Number(size3.value) || 100) / 100,
    ];
    const cnGlobalScale = (Number(cnGlobalSize.value) || 100) / 100;
    const offScale = size / 512;

    const offsets = [
      [(Number(x1.value) || 0) * offScale, (Number(y1.value) || 0) * offScale],
      [(Number(x2.value) || 0) * offScale, (Number(y2.value) || 0) * offScale],
      [(Number(x3.value) || 0) * offScale, (Number(y3.value) || 0) * offScale],
    ];
    const cnOffX = (Number(cnGlobalX.value) || 0) * offScale;
    const cnOffY = (Number(cnGlobalY.value) || 0) * offScale;

    ctx.fillStyle = m.fg;
    if (fontReady) {
      chars.forEach((ch, i) =>
        drawGlyph(
          positions[i][0] + offsets[i][0] + cnOffX,
          positions[i][1] + offsets[i][1] + cnOffY,
          cell,
          ch,
          scales[i] * cnGlobalScale
        )
      );
    } else {
      ctx.font = `${cell * 0.8}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      chars.forEach((ch, i) => {
        if (ch) ctx.fillText(ch, positions[i][0] + cell / 2, positions[i][1] + cell / 2);
      });
    }

    ctx.fillRect(cell, cell, cell, cell);

    drawEnglish(mode, size);
  }

  let rafId = null;
  function renderPreview() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      rafId = null;
      draw(getMode());
    });
  }

  function downloadBlob(mode, filename) {
    draw(mode);
    canvas.toBlob(function (blob) {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  }

  function download() {
    downloadBlob(getMode(), "logo.png");
  }

  function downloadAll() {
    Object.keys(MODES).forEach(function (mode, i) {
      setTimeout(function () {
        downloadBlob(mode, "logo_" + mode + ".png");
      }, i * 400);
    });
  }

  addEnBtn.addEventListener("click", function () {
    addEnLine("", 100);
    renderPreview();
  });
  [enGlobalSize, enGlobalX, enGlobalY, enLineSpacing].forEach((el) => el.addEventListener("input", renderPreview));
  [char1, char2, char3].forEach((el) => el.addEventListener("input", renderPreview));
  [size1, size2, size3].forEach((el) => el.addEventListener("input", renderPreview));
  [x1, y1, x2, y2, x3, y3].forEach((el) => el.addEventListener("input", renderPreview));
  [cnGlobalSize, cnGlobalX, cnGlobalY].forEach((el) => el.addEventListener("input", renderPreview));
  sizeInput.addEventListener("input", renderPreview);
  modeInputs.forEach((el) => el.addEventListener("change", renderPreview));
  downloadBtn.addEventListener("click", download);
  downloadAllBtn.addEventListener("click", downloadAll);

  loadFonts();
  addEnLine("ARKNIGHTS", 100);
  addEnLine("ENDFIELD", 100);
  addEnLine("", 100);
  addEnLine("", 100);
  addEnLine("", 100);

  // ============================================
  // Loading Cover (Endfield style)
  // ============================================
  (function initLoadingCover() {
    const cover = document.getElementById("loading-cover");
    if (!cover) return;
    document.body.style.overflow = "hidden";
    const percentEl = cover.querySelector(".progress-percent");
    const statusEl = cover.querySelector(".status-text");
    const phaseTexts = {
      init: "INITIALIZING",
      loading: "LOADING",
      complete: "READY",
      sweeping: "LAUNCHING",
      fadeout: "WELCOME",
    };
    function setPhase(p) {
      cover.className = "loading-cover " + p;
      if (statusEl) statusEl.textContent = phaseTexts[p];
    }
    let display = 0;
    let target = 0;
    setPhase("init");
    setTimeout(function () {
      setPhase("loading");
    }, 100);
    setTimeout(function () {
      target = 100;
    }, 1000);
    (function animate() {
      if (display < target) {
        const step = Math.max(0.5, (target - display) * 0.15);
        display = Math.min(target, display + step);
        cover.style.setProperty("--progress", display + "%");
        cover.style.setProperty("--progress-num", Math.floor(display));
        if (percentEl) percentEl.textContent = Math.floor(display) + "%";
      }
      requestAnimationFrame(animate);
    })();
    const checkDone = setInterval(function () {
      if (display >= 100) {
        clearInterval(checkDone);
        setPhase("complete");
        setTimeout(function () {
          setPhase("sweeping");
          setTimeout(function () {
            setPhase("fadeout");
            setTimeout(function () {
              cover.style.display = "none";
              document.body.style.overflow = "";
            }, 300);
          }, 400);
        }, 100);
      }
    }, 50);
  })();
})();
