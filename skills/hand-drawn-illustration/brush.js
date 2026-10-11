// Hand-drawn illustration primitives with variable-width brush lines.
// Usage in a DC logic class:
//   const B = await import('./skills/hand-drawn-illustration/brush.js');
//   const k = B.kit(React.createElement, { boil: this.state.boil });
//   k.line([x0,y0],[x1,y1], 3.6, seed) / k.poly(pts, fill, w, seed) / k.hatch(...) / k.sparkle(...)

export const INK = '#111';
export const EASE_OUT = x => 1 - Math.pow(1 - x, 3);
export const clamp = v => Math.max(0, Math.min(1, v));
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const mix = (a, b, k) => a + (b - a) * k;

const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
const fm = p => p[0].toFixed(1) + ' ' + p[1].toFixed(1);

// Isometric projection: x right-down, z left-down, y up.
export const iso = (cx, cy) => (x, y, z) => [cx + (x - z) * 0.866, cy + (x + z) * 0.5 - y];

// Variable-width brush outline along a polyline -> filled path "d".
// Thin at both ends, thicker mid-stroke, width + position jitter by seed.
export function brushPath(pts, w, seed, amp = 1) {
  const n = pts.length, len = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const T = len[n - 1] || 1, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const s = len[i] / T, pv = pts[Math.max(0, i - 1)], nx0 = pts[Math.min(n - 1, i + 1)];
    const dx = nx0[0] - pv[0], dy = nx0[1] - pv[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const wob = (noise(s * 3 + seed) - 0.5) * 2 * amp;
    const ww = w * (0.3 + 0.7 * Math.pow(Math.sin(Math.PI * s), 0.5)) * (0.75 + 0.5 * noise(s * 4 + seed + 50));
    const px = pts[i][0] + nx * wob, py = pts[i][1] + ny * wob;
    L.push([px + nx * ww / 2, py + ny * ww / 2]); R.push([px - nx * ww / 2, py - ny * ww / 2]);
  }
  return 'M' + L.concat(R.reverse()).map(fm).join('L') + 'Z';
}

// Squircle 4-point sparkle outline points.
export function sparklePts(cx, cy, r, rot = 0, steps = 48) {
  const out = [], cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i <= steps + 4; i++) {
    const f = (i % steps) / steps * Math.PI * 2, c = Math.cos(f), s = Math.sin(f);
    const x = r * Math.sign(c) * Math.pow(Math.abs(c), 2.4), y = r * Math.sign(s) * Math.pow(Math.abs(s), 2.4);
    out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return out;
}

// Bound helpers. `boil` (0..2) re-seeds every stroke so lines "boil" when it changes.
export function kit(h, { boil = 0, ink = INK } = {}) {
  const sd = s => s + boil * 37;
  const line = (p0, p1, w, seed, amp = 1) => {
    const o0 = 1 + hash(sd(seed)) * 3, o1 = 1 + hash(sd(seed) + 9) * 3; // overshoot past corners
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1;
    const a = [p0[0] - dx / l * o0, p0[1] - dy / l * o0], c = [p1[0] + dx / l * o1, p1[1] + dy / l * o1];
    const N = Math.max(4, Math.round(l / 8)), pts = [];
    for (let i = 0; i <= N; i++) { const k = i / N; pts.push([a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k]); }
    return h('path', { d: brushPath(pts, w, sd(seed), amp), fill: ink });
  };
  const curve = (pts, w, seed, amp = 1) => h('path', { d: brushPath(pts, w, sd(seed), amp), fill: ink });
  const fill = (pts, color) => h('path', { d: 'M' + pts.map(fm).join('L') + 'Z', fill: color });
  // Filled polygon + one stroke per edge (each edge its own seed -> uneven, overshooting corners).
  const poly = (pts, color, w, seed) => h('g', null, fill(pts, color), ...pts.map((p, i) => line(p, pts[(i + 1) % pts.length], w, seed + i * 13)));
  // Parallel hatch strokes between two point generators, t in 0..1 per stroke.
  const hatch = (count, from, to, w, seed) => Array.from({ length: count }, (_, i) => line(from(i, hash(i + 3)), to(i, hash(i + 7)), w, seed + i * 7, 0.6));
  const sparkle = (cx, cy, r, rot, color, seed) => r < 0.5 ? null : h('g', null,
    h('path', { d: 'M' + sparklePts(cx, cy, r, rot).slice(0, 49).map(fm).join('L') + 'Z', fill: color }),
    h('path', { d: brushPath(sparklePts(cx, cy, r, rot), Math.max(1.6, r * 0.13), sd(seed), 0.6), fill: ink }));
  // Radial "pop" ticks around a point; k 0..1 grows them.
  const rays = (cx, cy, r0, len, degs, k, w, seed) => k < 0.05 ? [] : degs.map((deg, i) => {
    const a = deg * Math.PI / 180;
    return line([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * (r0 + len * k), cy + Math.sin(a) * (r0 + len * k)], w, seed + i * 5, 0.4);
  });
  return { line, curve, fill, poly, hatch, sparkle, rays };
}

// Hover driver for a DC (class Component). Call from onMouseEnter/Leave.
//   tween(this, key, 1|0) animates this.state[key+'T'] 0..1 (≈620ms full travel, reversible mid-way)
//   boil(this, key, on)   steps this.state[key+'B'] 0..2 every 140ms while hovered
export function tween(c, key, to, full = 620) {
  c.__raf = c.__raf || {};
  const from = c.state[key + 'T'] || 0, dur = Math.max(120, full * Math.abs(to - from)), t0 = performance.now();
  cancelAnimationFrame(c.__raf[key]);
  const step = now => { const p = Math.min(1, (now - t0) / dur); c.setState({ [key + 'T']: from + (to - from) * p }); if (p < 1) c.__raf[key] = requestAnimationFrame(step); };
  c.__raf[key] = requestAnimationFrame(step);
}
export function boil(c, key, on, ms = 140) {
  c.__boil = c.__boil || {};
  clearInterval(c.__boil[key]);
  if (on) c.__boil[key] = setInterval(() => c.setState(s => ({ [key + 'B']: ((s[key + 'B'] || 0) + 1) % 3 })), ms);
  else c.setState({ [key + 'B']: 0 });
}
export function cleanup(c) {
  Object.values(c.__raf || {}).forEach(cancelAnimationFrame);
  Object.values(c.__boil || {}).forEach(clearInterval);
}
