window.MILLIY_TEATR = window.MILLIY_TEATR || {};

/**
 * Pure JavaScript QR Code Generator (Byte mode, Level L, Versions 1-4)
 * Produces a standard scannable QR matrix and draws crisp Canvas / E-Ticket PNGs.
 */
window.MILLIY_TEATR.QRCode = (function () {
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecCount) {
    const gen = rsGeneratorPoly(ecCount);
    const res = new Uint8Array(data.length + ecCount);
    res.set(data);
    for (let i = 0; i < data.length; i++) {
      const factor = res[i];
      if (factor !== 0) {
        for (let j = 0; j < gen.length; j++) {
          res[i + j] ^= gfMul(gen[j], factor);
        }
      }
    }
    return res.slice(data.length);
  }

  // Version specs for Error Correction Level L (single block for V1-V4)
  const VERSIONS = [
    { v: 1, size: 21, totalCodewords: 26, ecCount: 7, dataCodewords: 19, align: [] },
    { v: 2, size: 25, totalCodewords: 44, ecCount: 10, dataCodewords: 34, align: [6, 18] },
    { v: 3, size: 29, totalCodewords: 70, ecCount: 15, dataCodewords: 55, align: [6, 22] },
    { v: 4, size: 33, totalCodewords: 100, ecCount: 20, dataCodewords: 80, align: [6, 26] }
  ];

  function encodeBytes(text) {
    const bytes = new TextEncoder().encode(text);
    const spec = VERSIONS.find((s) => bytes.length + 2 <= s.dataCodewords) || VERSIONS[VERSIONS.length - 1];
    const maxBytes = spec.dataCodewords - 2;
    const payload = bytes.slice(0, maxBytes);

    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    };

    // Byte mode indicator 0100 + 8-bit length
    pushBits(0b0100, 4);
    pushBits(payload.length, 8);
    for (const b of payload) pushBits(b, 8);

    // Terminator (up to 4 zero bits)
    const maxBits = spec.dataCodewords * 8;
    for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const dataCw = new Uint8Array(spec.dataCodewords);
    for (let i = 0; i < bits.length / 8; i++) {
      let byte = 0;
      for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
      dataCw[i] = byte;
    }

    const pads = [0xec, 0x11];
    for (let i = bits.length / 8, p = 0; i < spec.dataCodewords; i++, p++) {
      dataCw[i] = pads[p % 2];
    }

    const ecCw = rsEncode(dataCw, spec.ecCount);
    const allCw = new Uint8Array(spec.totalCodewords);
    allCw.set(dataCw);
    allCw.set(ecCw, dataCw.length);

    return { spec, codewords: allCw };
  }

  function buildMatrix(text) {
    const { spec, codewords } = encodeBytes(text);
    const n = spec.size;
    const grid = Array.from({ length: n }, () => new Int8Array(n).fill(-1));
    const reserved = Array.from({ length: n }, () => new Uint8Array(n));

    function setModule(r, c, val, isReserved = true) {
      if (r < 0 || r >= n || c < 0 || c >= n) return;
      grid[r][c] = val ? 1 : 0;
      if (isReserved) reserved[r][c] = 1;
    }

    function placeFinder(top, left) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = top + r;
          const cc = left + c;
          if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
          const isBorder = r === -1 || r === 7 || c === -1 || c === 7;
          const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
          const isCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setModule(rr, cc, !isBorder && (isOuter || isCore));
        }
      }
    }

    placeFinder(0, 0);
    placeFinder(0, n - 7);
    placeFinder(n - 7, 0);

    // Alignment pattern for V2+
    if (spec.align.length >= 2) {
      const center = spec.align[1];
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const val = Math.max(Math.abs(r), Math.abs(c)) !== 1;
          setModule(center + r, center + c, val);
        }
      }
    }

    // Timing patterns
    for (let i = 8; i < n - 8; i++) {
      setModule(6, i, i % 2 === 0);
      setModule(i, 6, i % 2 === 0);
    }

    // Dark module + reserve format info areas
    setModule(n - 8, 8, 1);
    for (let i = 0; i < 9; i++) {
      if (!reserved[8][i]) setModule(8, i, 0);
      if (!reserved[i][8]) setModule(i, 8, 0);
    }
    for (let i = 0; i < 8; i++) {
      if (!reserved[8][n - 1 - i]) setModule(8, n - 1 - i, 0);
      if (!reserved[n - 1 - i][8]) setModule(n - 1 - i, 8, 0);
    }

    // Place data bits (mask 0: (r + c) % 2 === 0)
    let bitIdx = 0;
    const totalBits = codewords.length * 8;
    let up = true;
    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let step = 0; step < n; step++) {
        const r = up ? n - 1 - step : step;
        for (let dx = 0; dx < 2; dx++) {
          const c = col - dx;
          if (reserved[r][c]) continue;
          let bit = 0;
          if (bitIdx < totalBits) {
            bit = (codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
          }
          // Apply mask 0
          if ((r + c) % 2 === 0) bit ^= 1;
          grid[r][c] = bit;
        }
      }
      up = !up;
    }

    // Format info for Level L (01), Mask 0 (000) -> 5-bit 01000, BCH + XOR 101010000010010 = 111011111000100
    const formatBits = 0b111011111000100;
    for (let i = 0; i < 15; i++) {
      const bit = (formatBits >> (14 - i)) & 1;
      if (i < 6) grid[8][i] = bit;
      else if (i < 8) grid[8][i + 1] = bit;
      else grid[8][n - 15 + i] = bit;

      if (i < 8) grid[n - 1 - i][8] = bit;
      else if (i < 9) grid[7][8] = bit;
      else grid[14 - i][8] = bit;
    }

    return grid;
  }

  function renderToCanvas(canvas, text, options = {}) {
    const matrix = buildMatrix(text);
    const n = matrix.length;
    const scale = options.scale || 5;
    const quiet = options.quiet !== undefined ? options.quiet : 3;
    const size = (n + quiet * 2) * scale;

    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = options.bg || "#FFFFFF";
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = options.fg || "#18181B";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c] === 1) {
          ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
      }
    }
    return canvas;
  }

  function downloadTicketPng(ticket) {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 460;
    const ctx = canvas.getContext("2d");

    // Card background
    ctx.fillStyle = "#FAF9F6";
    ctx.fillRect(0, 0, 900, 460);

    // Left accent bar
    ctx.fillStyle = "#A63A2B";
    ctx.fillRect(0, 0, 18, 460);

    // Inner ticket border
    ctx.strokeStyle = "#E5E0D5";
    ctx.lineWidth = 2;
    ctx.strokeRect(32, 24, 844, 412);

    // Tear-off dashed divider
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = "#D4CEC2";
    ctx.beginPath();
    ctx.moveTo(615, 24);
    ctx.lineTo(615, 436);
    ctx.stroke();
    ctx.restore();

    // Header
    ctx.fillStyle = "#A63A2B";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText("MUQIMIY NOMIDAGI O'ZBEKISTON DAVLAT AKADEMIK MUSIQALI TEATRI", 58, 66);

    // Show title
    ctx.fillStyle = "#18181B";
    ctx.font = "bold 34px Georgia, serif";
    ctx.fillText(ticket.showTitle, 58, 120);

    // Session
    ctx.fillStyle = "#52525B";
    ctx.font = "600 18px sans-serif";
    ctx.fillText(ticket.sessionLabel + "  ·  " + ticket.hallLabel, 58, 156);

    // Divider line
    ctx.strokeStyle = "#E5E0D5";
    ctx.beginPath();
    ctx.moveTo(58, 182);
    ctx.lineTo(590, 182);
    ctx.stroke();

    // Details
    ctx.fillStyle = "#71717A";
    ctx.font = "600 13px sans-serif";
    ctx.fillText(ticket.labels.seats.toUpperCase(), 58, 214);
    ctx.fillStyle = "#18181B";
    ctx.font = "600 16px sans-serif";
    const seatLines = wrapText(ctx, ticket.seatSummary, 520);
    seatLines.slice(0, 2).forEach((line, idx) => {
      ctx.fillText(line, 58, 238 + idx * 22);
    });

    ctx.fillStyle = "#71717A";
    ctx.font = "600 13px sans-serif";
    ctx.fillText(ticket.labels.guest.toUpperCase(), 58, 304);
    ctx.fillStyle = "#18181B";
    ctx.font = "600 17px sans-serif";
    ctx.fillText(`${ticket.customerName}  (${ticket.customerPhone})`, 58, 328);

    ctx.fillStyle = "#71717A";
    ctx.font = "600 13px sans-serif";
    ctx.fillText(ticket.labels.total.toUpperCase(), 58, 374);
    ctx.fillStyle = "#A63A2B";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(ticket.totalFormatted, 58, 402);

    // Right side QR + Code
    const qrCanvas = document.createElement("canvas");
    renderToCanvas(qrCanvas, ticket.qrPayload, { scale: 5, quiet: 2, bg: "#FFFFFF", fg: "#18181B" });
    const qrX = 615 + (261 - qrCanvas.width) / 2;
    const qrY = 66;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(qrX - 10, qrY - 10, qrCanvas.width + 20, qrCanvas.height + 20);
    ctx.strokeStyle = "#E5E0D5";
    ctx.strokeRect(qrX - 10, qrY - 10, qrCanvas.width + 20, qrCanvas.height + 20);
    ctx.drawImage(qrCanvas, qrX, qrY);

    ctx.fillStyle = "#71717A";
    ctx.font = "600 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ticket.labels.code.toUpperCase(), 745, qrY + qrCanvas.height + 42);

    ctx.fillStyle = "#A63A2B";
    ctx.font = "bold 24px monospace";
    ctx.fillText(ticket.code, 745, qrY + qrCanvas.height + 72);

    ctx.fillStyle = "#52525B";
    ctx.font = "12px sans-serif";
    ctx.fillText("muqimiyteatr.uz", 745, 410);

    const link = document.createElement("a");
    link.download = `Muqimiy-Chipta-${ticket.code}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let current = "";
    for (const w of words) {
      const test = current ? current + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  return { renderToCanvas, downloadTicketPng, buildMatrix };
})();
