function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

export function generateSkybox(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000005';
  ctx.fillRect(0, 0, width, height);

  // faint galactic band across the middle
  ctx.save();
  const band = ctx.createLinearGradient(0, height * 0.32, 0, height * 0.68);
  band.addColorStop(0, 'rgba(90,100,170,0)');
  band.addColorStop(0.5, 'rgba(150,160,220,0.22)');
  band.addColorStop(1, 'rgba(90,100,170,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, height * 0.28, width, height * 0.44);
  ctx.restore();

  // nebula blobs
  const nebulaColors = ['#6d28d9', '#1e3a8a', '#db2777', '#0ea5e9', '#7c3aed', '#0f766e'];
  for (let i = 0; i < 12; i++) {
    const cx = Math.random() * width;
    const cy = height * 0.12 + Math.random() * height * 0.76;
    const r = 50 + Math.random() * 170;
    const c = hexToRgb(nebulaColors[i % nebulaColors.length]);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.32)`);
    grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // stars
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const b = Math.random();
    const size = b > 0.97 ? 1.9 : b > 0.85 ? 1.2 : 0.6;
    const alpha = 0.35 + b * 0.65;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, size, size);
  }

  return canvas;
}
