// ============================================================
// STUDIOFLOW — Campo de assinatura (dedo, caneta ou mouse)
// Usado na tela de Contratos (sua assinatura) e na página
// pública em que o cliente assina.
// ============================================================

export function criarPadAssinatura(canvas, { cor = '#10204A' } = {}) {
  const ctx = canvas.getContext('2d');
  let desenhando = false, ultimo = null, temTraco = false;

  function preparar() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, r.width * dpr); canvas.height = Math.max(1, r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = cor;
    temTraco = false;
  }

  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    desenhando = true; ultimo = pos(e); canvas.setPointerCapture(e.pointerId);
    ctx.beginPath(); ctx.arc(ultimo.x, ultimo.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = cor; ctx.fill();
    temTraco = true;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!desenhando) return;
    e.preventDefault();
    const p = pos(e);
    const dist = Math.hypot(p.x - ultimo.x, p.y - ultimo.y);
    ctx.lineWidth = Math.max(1.4, Math.min(3.2, 3.4 - dist * 0.08)); // traço mais fino quando rápido
    ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y);
    ctx.quadraticCurveTo(ultimo.x, ultimo.y, (ultimo.x + p.x) / 2, (ultimo.y + p.y) / 2); ctx.lineTo(p.x, p.y); ctx.stroke();
    ultimo = p; temTraco = true;
  });
  ['pointerup', 'pointercancel'].forEach(ev => canvas.addEventListener(ev, () => desenhando = false));

  function desenharImagem(src, margem = 20) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const r = canvas.getBoundingClientRect();
        const s = Math.min((r.width - margem * 2) / img.width, (r.height - margem * 2) / img.height, 1.5);
        ctx.drawImage(img, (r.width - img.width * s) / 2, (r.height - img.height * s) / 2, img.width * s, img.height * s);
        temTraco = true; resolve();
      };
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  // Exporta PNG recortado (sem bordas vazias) para ficar bem posicionado no PDF
  function exportar() {
    if (!temTraco) return null;
    const { width: w, height: h } = canvas;
    const px = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0 || (x1 - x0) < 15) return null; // rabisco pequeno demais
    const m = 6;
    x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
    let out = document.createElement('canvas');
    out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    // limita o tamanho (fica leve no banco)
    const maxW = 700;
    if (out.width > maxW) {
      const r = document.createElement('canvas');
      r.width = maxW; r.height = Math.round(out.height * maxW / out.width);
      r.getContext('2d').drawImage(out, 0, 0, r.width, r.height);
      out = r;
    }
    return out.toDataURL('image/png');
  }

  return { preparar, limpar: preparar, desenharImagem, exportar, get temTraco() { return temTraco; } };
}
