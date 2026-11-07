/* XAYOLCHI SHAHRI: a 2.5D city of subscriber houses. Plain canvas, no libraries. */
(() => {
  'use strict';
  const cv = document.getElementById('city'); let ctx = cv.getContext('2d');
  const VIDEO = new URLSearchParams(location.search).has('video');
  if (VIDEO) document.body.classList.add('video');

  // ---------- data ----------
  const STYLES = {
    kulba: "Shinam kulba", qala: "Qal'a", minora: 'Shisha minora', gumbaz: 'Gumbazli uy',
    villa: 'Zamonaviy villa', otov: "O'tov", xayolchi: 'Shahar asoschisi uyi'
  };
  const COLS = 13, ROWS = 60, MAH_ROWS = 4;
  let houses = [];
  const plots = [];
  for (let z = 0; z < ROWS; z++) for (let x = -6; x <= 6; x++) plots.push({ x, z });
  plots.sort((a, b) => a.z - b.z || Math.abs(a.x) - Math.abs(b.x) || a.x - b.x);
  const plotKey = (x, z) => x + ':' + z;
  let byPlot = new Map();
  const plotIdx = new Map(plots.map((p, i) => [plotKey(p.x, p.z), i]));

  const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const STREETS = ['Oydin', 'Yulduz', 'Xayol', 'Orzu', 'Bahor', 'Navro‘z', 'Ilhom', 'Tong'];

  function assign(list) {
    houses = list.map((h, i) => {
      const p = plots[i];
      const r = rng(hash(h.nick));
      return { ...h, n: i, x: p.x, z: p.z, sizeK: 1 + Math.min(1, Math.log10((h.likes || 0) + 1) / 3), seed: hash(h.nick), tint: r() };
    });
    byPlot = new Map(houses.map(h => [plotKey(h.x, h.z), h]));
    document.getElementById('aholi').textContent = houses.length.toLocaleString('en-US').replace(/,/g, ' ');
  }
  const mahalla = z => 1 + Math.floor(z / MAH_ROWS);
  const placeOf = h => `${mahalla(h.z)}-Mahalla · ${STREETS[h.z % STREETS.length]} ko‘chasi · ${Math.abs(h.x) + 1}-uy`;

  // ---------- camera & projection ----------
  let W = 0, H = 0, DPR = 1;
  const cam = { x: 0, z: -.2, zoom: 1, u: 1 };
  let target = null, night = true, t0 = performance.now(), highlight = null, demo = [];
  const D0 = 1.6, SP = 2.7;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = cv.width = Math.round(innerWidth * DPR); H = cv.height = Math.round(innerHeight * DPR);
  }
  const hor = () => H * .34;
  const U = () => Math.min(W * .24, H * .115) * (cam.u || 1);
  function proj(x, z) {
    const d = (z - cam.z) * SP + D0;
    if (d < .25) return null;
    const k = D0 / d * cam.zoom;
    return { x: W / 2 + (x - cam.x) * U() * k, y: hor() + (H - hor()) * .74 * k, k };
  }

  // ---------- drawing helpers ----------
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255; r = Math.round(f < 0 ? r * (1 + f) : r + (255 - r) * f); g = Math.round(f < 0 ? g * (1 + f) : g + (255 - g) * f); b = Math.round(f < 0 ? b * (1 + f) : b + (255 - b) * f); return `rgb(${r},${g},${b})`; };
  function poly(pts, fill, stroke = '#14103A', lw = 1) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.stroke(); } }
  function rr(x, y, w, h, r, fill, stroke, lw) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); } }
  // A box with front face and a parallax side face. sd: side shift (px), dy: depth rise (px).
  function block(x0, y0, w, h, c, sd, dy, lw, flatTop = true) {
    if (sd > 0) poly([[x0, y0], [x0 - sd, y0 - dy], [x0 - sd, y0 - h - dy], [x0, y0 - h]], shade(c, -.32), '#14103A', lw);
    if (sd < 0) poly([[x0 + w, y0], [x0 + w - sd, y0 - dy], [x0 + w - sd, y0 - h - dy], [x0 + w, y0 - h]], shade(c, -.32), '#14103A', lw);
    if (flatTop) poly([[x0, y0 - h], [x0 + w, y0 - h], [x0 + w - sd, y0 - h - dy], [x0 - sd, y0 - h - dy]], shade(c, .18), '#14103A', lw);
    poly([[x0, y0], [x0 + w, y0], [x0 + w, y0 - h], [x0, y0 - h]], c, '#14103A', lw);
  }
  function win(x, y, w, h, lit, lw) { rr(x, y, w, h, w * .12, lit ? '#FFD98A' : '#2A3A6A', '#14103A', lw); if (lit) { ctx.fillStyle = 'rgba(255,217,138,.18)'; ctx.fillRect(x - w * .4, y - h * .3, w * 1.8, h * 1.6); } }
  function door(x, y, w, h, c, lw) { rr(x, y - h, w, h, w * .5, c, '#14103A', lw); }
  const PAL = ['#F4C27A', '#EF8E6A', '#8FC8E8', '#B9A7E8', '#F2D7A8', '#9AD7A0', '#E8A0B8', '#F0E0C8'];
  const ROOF = ['#C2402E', '#4A3EA0', '#2F7A5A', '#8E2A50', '#B86A20', '#2C5FA8'];

  function drawHouse(kind, bx, by, u, h, ctxNight, sideK) {
    const r = rng(h.seed || 7), wall = PAL[Math.floor(r() * PAL.length)], roof = ROOF[Math.floor(r() * ROOF.length)];
    const s = h.sizeK || 1, lw = Math.max(1, u * .02), sd = sideK * u * .22, dy = u * .16, lit = ctxNight;
    const W_ = (f) => u * f * Math.sqrt(s), Hh = (f) => u * f * s;
    ctx.save();
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(bx, by + u * .02, u * .55 * Math.sqrt(s), u * .1, 0, 0, Math.PI * 2); ctx.fill();
    if (kind === 'minora') {
      const w = W_(.48), hh = Hh(1.5), x0 = bx - w / 2;
      const g = ctx.createLinearGradient(x0, by - hh, x0 + w, by); g.addColorStop(0, '#BFF0FF'); g.addColorStop(.5, '#5AB8E8'); g.addColorStop(1, '#2C6FB7');
      block(x0, by, w, hh, '#5AB8E8', sd, dy, lw); poly([[x0, by], [x0 + w, by], [x0 + w, by - hh], [x0, by - hh]], g, '#14103A', lw);
      const cols = 3, rows = Math.max(4, Math.round(hh / (u * .16)));
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const on = lit && r() > .45; ctx.fillStyle = on ? 'rgba(255,230,160,.95)' : 'rgba(255,255,255,.22)'; ctx.fillRect(x0 + w * (.12 + j * .28), by - hh + hh * (.05 + i / rows * .9), w * .18, hh / rows * .55); }
      ctx.strokeStyle = '#14103A'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(bx, by - hh); ctx.lineTo(bx, by - hh - u * .3); ctx.stroke();
      ctx.fillStyle = (performance.now() / 500 | 0) % 2 ? '#FF3B3B' : '#7A1010'; ctx.beginPath(); ctx.arc(bx, by - hh - u * .3, u * .035, 0, 7); ctx.fill();
    } else if (kind === 'qala') {
      const w = W_(.86), hh = Hh(.48), x0 = bx - w / 2, stone = '#C9C2D8';
      block(x0, by, w, hh, stone, sd, dy, lw);
      for (let i = 0; i < 6; i++) rr(x0 + i * w / 5.5, by - hh - u * .07, w / 11, u * .07, 0, stone, '#14103A', lw);
      rr(bx - w * .12, by - hh * .62, w * .24, hh * .62, w * .12, '#5A3A2A', '#14103A', lw);
      [x0 - w * .06, x0 + w * .82].forEach(tx => {
        const tw = w * .24, th = Hh(.92);
        block(tx, by, tw, th, shade(stone, -.05), sd * .6, dy * .6, lw, false);
        poly([[tx - tw * .1, by - th], [tx + tw * 1.1, by - th], [tx + tw / 2, by - th - u * .32 * s]], roof, '#14103A', lw);
        win(tx + tw * .3, by - th * .6, tw * .4, th * .16, lit, lw);
        ctx.strokeStyle = '#14103A'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(tx + tw / 2, by - th - u * .32 * s); ctx.lineTo(tx + tw / 2, by - th - u * .48 * s); ctx.stroke();
        poly([[tx + tw / 2, by - th - u * .48 * s], [tx + tw / 2 + u * .14, by - th - u * .44 * s], [tx + tw / 2, by - th - u * .4 * s]], '#FFD35C', '#14103A', lw * .6);
      });
      win(x0 + w * .22, by - hh * .78, w * .1, hh * .22, lit, lw); win(x0 + w * .68, by - hh * .78, w * .1, hh * .22, lit, lw);
    } else if (kind === 'gumbaz' || kind === 'xayolchi') {
      const gold = kind === 'xayolchi', w = W_(gold ? .95 : .82), hh = Hh(.46), x0 = bx - w / 2, sand = gold ? '#F2D7A8' : '#EAD2A6', tile = gold ? '#E5336D' : '#2C6FB7';
      const domeR = w * .3, dc = gold ? '#FFD35C' : '#3A86D4';
      ctx.beginPath(); ctx.ellipse(bx - sd * .4, by - hh - dy * .5, domeR, domeR * 1.15, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = dc; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#14103A'; ctx.stroke();
      ctx.strokeStyle = shade(dc, -.3); for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(bx - sd * .4, by - hh - dy * .5, Math.abs(domeR * i / 2.4) + .01, domeR * 1.15, 0, Math.PI, 0); ctx.stroke(); }
      ctx.strokeStyle = '#14103A'; ctx.beginPath(); ctx.moveTo(bx - sd * .4, by - hh - dy * .5 - domeR * 1.15); ctx.lineTo(bx - sd * .4, by - hh - dy * .5 - domeR * 1.5); ctx.stroke();
      if (gold) { ctx.fillStyle = '#FFD35C'; ctx.beginPath(); ctx.arc(bx - sd * .4, by - hh - dy * .5 - domeR * 1.58, u * .05, 0, 7); ctx.fill(); ctx.stroke(); }
      else { ctx.fillStyle = '#FFD35C'; ctx.beginPath(); ctx.arc(bx - sd * .4, by - hh - dy * .5 - domeR * 1.55, u * .03, 0, 7); ctx.fill(); }
      block(x0, by, w, hh, sand, sd, dy, lw);
      const pw = w * .42, ph = Hh(.66), px = bx - pw / 2;
      block(px, by, pw, ph, tile, 0, 0, lw, false);
      ctx.beginPath(); ctx.moveTo(px + pw * .18, by); ctx.lineTo(px + pw * .18, by - ph * .55); ctx.quadraticCurveTo(px + pw * .18, by - ph * .85, bx, by - ph * .9); ctx.quadraticCurveTo(px + pw * .82, by - ph * .85, px + pw * .82, by - ph * .55); ctx.lineTo(px + pw * .82, by); ctx.closePath();
      ctx.fillStyle = lit ? '#FFC870' : '#1E3A6A'; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = lw * .8; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(px + pw * i / 4, by - ph); ctx.lineTo(px + pw * i / 4, by - ph * .94); ctx.stroke(); }
      win(x0 + w * .07, by - hh * .7, w * .13, hh * .32, lit, lw); win(x0 + w * .8, by - hh * .7, w * .13, hh * .32, lit, lw);
    } else if (kind === 'villa') {
      const w = W_(.92), h1 = Hh(.32), x0 = bx - w / 2, white = '#F4F2FA';
      ctx.fillStyle = '#3BC0E8'; ctx.beginPath(); ctx.ellipse(bx + w * .2, by + u * .06, w * .3, u * .06, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#14103A'; ctx.lineWidth = lw; ctx.stroke();
      block(x0, by, w, h1, white, sd, dy, lw);
      block(x0 + w * .1, by - h1, w * .55, Hh(.28), white, sd, dy, lw);
      ctx.fillStyle = lit ? 'rgba(160,240,255,.95)' : '#3A5A8A'; ctx.fillRect(x0 + w * .08, by - h1 * .85, w * .52, h1 * .6); ctx.fillRect(x0 + w * .16, by - h1 - Hh(.22), w * .42, Hh(.16));
      ctx.strokeStyle = '#14103A'; ctx.strokeRect(x0 + w * .08, by - h1 * .85, w * .52, h1 * .6); ctx.strokeRect(x0 + w * .16, by - h1 - Hh(.22), w * .42, Hh(.16));
      door(x0 + w * .7, by, w * .14, h1 * .7, '#7A4A2E', lw);
    } else if (kind === 'otov') {
      const w = W_(.8), hh = Hh(.5);
      ctx.beginPath(); ctx.moveTo(bx - w / 2, by); ctx.lineTo(bx - w / 2, by - hh * .45); ctx.quadraticCurveTo(bx - w * .45, by - hh, bx, by - hh * 1.05); ctx.quadraticCurveTo(bx + w * .45, by - hh, bx + w / 2, by - hh * .45); ctx.lineTo(bx + w / 2, by); ctx.closePath();
      ctx.fillStyle = '#F4ECD4'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#14103A'; ctx.stroke();
      ctx.fillStyle = '#C2402E'; ctx.fillRect(bx - w / 2, by - hh * .5, w, hh * .1); ctx.strokeRect(bx - w / 2, by - hh * .5, w, hh * .1);
      ctx.fillStyle = '#FFD35C'; for (let i = 0; i < 6; i++) { ctx.beginPath(); const xx = bx - w * .42 + i * w * .17; ctx.moveTo(xx, by - hh * .45); ctx.lineTo(xx + w * .04, by - hh * .49); ctx.lineTo(xx + w * .08, by - hh * .45); ctx.fill(); }
      door(bx - w * .1, by, w * .2, hh * .38, lit ? '#FFC870' : '#8E2A20', lw);
      rr(bx - w * .08, by - hh * 1.1, w * .16, hh * .08, 3, '#7A4A2E', '#14103A', lw);
    } else { // kulba
      const w = W_(.76), hh = Hh(.42), x0 = bx - w / 2;
      rr(x0 + w * .68, by - hh - u * .36 * s, w * .12, u * .3 * s, 2, '#8E5A3A', '#14103A', lw);
      block(x0, by, w, hh, wall, sd, dy, lw, false);
      const ov = w * .1, ap = by - hh - u * .42 * s;
      if (sd) poly([[sd > 0 ? x0 - ov : x0 + w + ov, by - hh], [sd > 0 ? x0 - ov - sd : x0 + w + ov - sd, by - hh - dy], [bx - sd, ap - dy], [bx, ap]], shade(roof, -.2), '#14103A', lw);
      poly([[x0 - ov, by - hh], [x0 + w + ov, by - hh], [bx, ap]], roof, '#14103A', lw);
      win(bx - w * .09, by - hh - u * .26 * s, w * .18, u * .12 * s, lit, lw);
      door(bx - w * .1, by, w * .2, hh * .62, '#7A4A2E', lw);
      win(x0 + w * .1, by - hh * .72, w * .18, hh * .3, lit, lw); win(x0 + w * .72, by - hh * .72, w * .18, hh * .3, lit, lw);
    }
    ctx.restore();
  }
  function houseTop(kind, u, s) { return u * s * ({ minora: 1.85, qala: 1.42, gumbaz: 1.05, xayolchi: 1.15, villa: .78, otov: .65, kulba: .95 }[kind] || 1); }

  function label(x, y, text, k, on) {
    const fs = Math.max(10 * DPR, Math.min(U() * k * .17, 44 * DPR));
    ctx.font = `800 ${fs}px Inter, system-ui, sans-serif`;
    const w = ctx.measureText(text).width + fs * 1.1, h = fs * 1.6;
    rr(x - w / 2, y - h, w, h, h / 2, on ? '#FFD35C' : 'rgba(14,11,46,.88)', on ? '#14103A' : 'rgba(255,211,92,.7)', Math.max(1, fs * .08));
    ctx.fillStyle = on ? '#14103A' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - h / 2 + 1);
    ctx.beginPath(); ctx.moveTo(x - fs * .3, y); ctx.lineTo(x, y + fs * .4); ctx.lineTo(x + fs * .3, y); ctx.fillStyle = on ? '#FFD35C' : 'rgba(14,11,46,.88)'; ctx.fill();
    return { x: x - w / 2, y: y - h, w, h };
  }

  function tree(x, y, u, r) { const s = u * (.16 + r * .08); ctx.fillStyle = '#5A3A2A'; ctx.fillRect(x - s * .12, y - s * .9, s * .24, s * .9); ctx.fillStyle = r > .5 ? '#3E9A58' : '#58B86C'; ctx.beginPath(); ctx.arc(x, y - s * 1.2, s * .62, 0, 7); ctx.fill(); ctx.strokeStyle = '#14103A'; ctx.lineWidth = Math.max(1, u * .015); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(x - s * .2, y - s * 1.4, s * .2, 0, 7); ctx.fill(); }
  function lamp(x, y, u) { const s = u * .45; ctx.strokeStyle = '#2A2A3A'; ctx.lineWidth = Math.max(1, u * .02); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s); ctx.stroke(); ctx.fillStyle = night ? '#FFE9A8' : '#C9C2D8'; ctx.beginPath(); ctx.arc(x, y - s, u * .04, 0, 7); ctx.fill(); if (night) { const g = ctx.createRadialGradient(x, y - s, 0, x, y - s, u * .5); g.addColorStop(0, 'rgba(255,220,140,.35)'); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - s, u * .5, 0, 7); ctx.fill(); } }
  function carAt(x, y, u, c, dir) { const w = u * .34, h = u * .12; ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); rr(-w / 2, -h, w, h * .7, h * .2, c, '#14103A', Math.max(1, u * .012)); rr(-w * .25, -h * 1.4, w * .5, h * .5, h * .2, shade(c, -.15), '#14103A', Math.max(1, u * .012)); ctx.fillStyle = '#14103A'; ctx.beginPath(); ctx.arc(-w * .28, -h * .3, h * .22, 0, 7); ctx.arc(w * .28, -h * .3, h * .22, 0, 7); ctx.fill(); if (night) { ctx.fillStyle = '#FFE9A8'; ctx.fillRect(w * .44, -h * .85, w * .06, h * .2); } ctx.restore(); }

  // ---------- scene ----------
  const STARS = Array.from({ length: 140 }, (_, i) => { const r = rng(i + 9); return [r(), r() * .9, r() * 1.6 + .4]; });
  let hits = [];
  function draw(time) {
    const t = time / 1000;
    ctx.clearRect(0, 0, W, H);
    const hz = hor();
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, hz + H * .05);
    if (night) { sky.addColorStop(0, '#120E3A'); sky.addColorStop(.6, '#3A2470'); sky.addColorStop(1, '#C86A6A'); } else { sky.addColorStop(0, '#6FC6F0'); sky.addColorStop(1, '#FFE9B8'); }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 2);
    if (night) { ctx.fillStyle = '#fff'; STARS.forEach(([sx, sy, ss], i) => { ctx.globalAlpha = .35 + .4 * Math.sin(t * 2 + i); ctx.fillRect(sx * W, sy * hz, ss * DPR, ss * DPR); }); ctx.globalAlpha = 1; }
    const mx = W * (VIDEO ? .86 : .8) - cam.x * 6, my = hz * (VIDEO ? .84 : .62), mr = Math.min(W, H) * (VIDEO ? .045 : .055);
    const mg = ctx.createRadialGradient(mx, my, mr * .6, mx, my, mr * 2.4); mg.addColorStop(0, night ? 'rgba(255,211,92,.35)' : 'rgba(255,255,220,.5)'); mg.addColorStop(1, 'rgba(255,211,92,0)'); ctx.fillStyle = mg; ctx.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
    ctx.fillStyle = night ? '#FFD35C' : '#FFF6C8'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
    // mountains
    [[.0, '#3A2A6E', .55], [.35, '#2A1E58', .8]].forEach(([off, c, hgt], li) => {
      ctx.fillStyle = night ? c : (li ? '#7FA0C8' : '#9AB8D8'); ctx.beginPath(); ctx.moveTo(0, hz);
      for (let i = 0; i <= 12; i++) { const xx = i / 12 * W, yy = hz - (Math.sin(i * 1.7 + off * 9 + cam.x * .05 * (li + 1)) * .5 + .5) * H * .09 * hgt - H * .02; ctx.lineTo(xx, yy); }
      ctx.lineTo(W, hz); ctx.fill();
    });
    // ground
    const gg = ctx.createLinearGradient(0, hz, 0, H); gg.addColorStop(0, night ? '#2A3A3A' : '#7CBF6A'); gg.addColorStop(1, night ? '#1E3A2A' : '#5AA050'); ctx.fillStyle = gg; ctx.fillRect(0, hz, W, H - hz);
    hits = [];
    const zFar = Math.min(ROWS - 1, Math.ceil(cam.z + 16)), zNear = Math.max(0, Math.floor(cam.z - 1));
    const xs = [-6.9, 6.9];
    for (let z = zFar; z >= zNear; z--) {
      const fogA = Math.min(1, Math.max(0, (z - cam.z - 7) / 8));
      // road behind row z (between z and z+1)
      const a = proj(xs[0], z + .62), b = proj(xs[1], z + .62), c = proj(xs[1], z + .38), d = proj(xs[0], z + .38);
      if (a && b && c && d) {
        poly([[a.x, a.y], [b.x, b.y], [c.x, c.y], [d.x, d.y]], night ? '#23233A' : '#5A5C70', null);
        const m1 = proj(-6.9, z + .5), m2 = proj(6.9, z + .5);
        ctx.strokeStyle = night ? 'rgba(255,233,168,.5)' : 'rgba(255,255,255,.7)'; ctx.setLineDash([m1.k * U() * .2, m1.k * U() * .16]); ctx.lineWidth = Math.max(1, m1.k * U() * .025); ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y); ctx.stroke(); ctx.setLineDash([]);
        // cars
        const r = rng(z * 31 + 7);
        for (let i = 0; i < 2; i++) { const sp = .25 + r() * .4, dir = r() > .5 ? 1 : -1, x = ((r() * 14 + dir * t * sp) % 14 + 14) % 14 - 7, p = proj(x, z + .5 + (dir > 0 ? -.05 : .05)); if (p && r() > .25) carAt(p.x, p.y, U() * p.k, PAL[Math.floor(r() * PAL.length)], dir); }
      }
      // plots of row z
      const row = [];
      for (let x = -6; x <= 6; x++) row.push(x);
      row.sort((p, q) => Math.abs(q - cam.x) - Math.abs(p - cam.x));
      for (const x of row) {
        const p = proj(x, z); if (!p) continue;
        const u = U() * p.k; if (p.x < -u * 2 || p.x > W + u * 2) continue;
        const h = byPlot.get(plotKey(x, z)) || demo.find(d => d.x === x && d.z === z);
        // lawn patch
        const l1 = proj(x - .45, z - .3), l2 = proj(x + .45, z - .3), l3 = proj(x + .45, z + .3), l4 = proj(x - .45, z + .3);
        if (l1 && l4) poly([[l1.x, l1.y], [l2.x, l2.y], [l3.x, l3.y], [l4.x, l4.y]], h ? (night ? '#2F5A3A' : '#8FD07A') : (night ? '#243A30' : '#79B866'), 'rgba(0,0,0,.2)', 1);
        const r = rng(x * 97 + z * 13 + 3);
        if (r() > .55) { const tp = proj(x + .42, z - .2); if (tp) tree(tp.x, tp.y, U() * tp.k, r()); }
        if (x === -6 || x === 6) { const lp = proj(x + (x < 0 ? -.55 : .55), z + .38); if (lp) lamp(lp.x, lp.y, U() * lp.k); }
        if (h) {
          const sideK = Math.max(-1, Math.min(1, (x - cam.x) * .35));
          drawHouse(h.style, p.x, p.y, u, h, night, sideK);
          const top = p.y - houseTop(h.style, u, h.sizeK || 1);
          const on = highlight === h;
          if (p.k > .34 || on) { const box = label(p.x, top - u * .05, '@' + h.nick, p.k, on); hits.push({ h, box: { x: p.x - u * .6, y: top - u * .3, w: u * 1.2, h: p.y - top + u * .35 }, k: p.k }); hits.push({ h, box, k: p.k + .001 }); }
          else hits.push({ h, box: { x: p.x - u * .6, y: top, w: u * 1.2, h: p.y - top }, k: p.k });
          if (h.style === 'xayolchi' && XIMG.complete && p.k > .25) { const ih = u * .9, iw = ih * .625; ctx.drawImage(XIMG, p.x + u * .55, p.y - ih, iw, ih); }
        } else if (p.k > .42 && (plotIdx.get(plotKey(x, z)) ?? 1e9) < houses.length + demo.length + 24) {
          // empty plot sign
          const s = u * .22; ctx.fillStyle = '#7A4A2E'; ctx.fillRect(p.x - s * .06, p.y - s * 1.6, s * .12, s * 1.6);
          rr(p.x - s * 1.4, p.y - s * 2.3, s * 2.8, s * .9, s * .12, '#F4ECD4', '#14103A', Math.max(1, s * .05));
          ctx.fillStyle = '#7A1420'; ctx.font = `800 ${s * .48}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BO‘SH', p.x, p.y - s * 1.85);
        }
      }
      if (fogA > 0) { const f1 = proj(0, z - .5); if (f1) { ctx.fillStyle = night ? `rgba(58,36,112,${fogA * .5})` : `rgba(255,233,184,${fogA * .5})`; ctx.fillRect(0, hz, W, f1.y - hz); } }
    }
    hits.sort((a, b) => b.k - a.k);
  }

  const XIMG = new Image(); XIMG.src = 'xayolchi.png';

  // ---------- interaction ----------
  const ptr = new Map(); let dragged = false, last = null, pinch = null;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); dragged = false; last = [e.clientX, e.clientY]; target = null; if (ptr.size === 2) { const [p1, p2] = [...ptr.values()]; pinch = { d: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), z: cam.zoom }; } });
  cv.addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptr.size === 2 && pinch) { const [p1, p2] = [...ptr.values()]; cam.zoom = clamp(pinch.z * Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) / pinch.d, .45, 2.6); dragged = true; return; }
    const dx = (e.clientX - last[0]) * DPR, dy = (e.clientY - last[1]) * DPR; last = [e.clientX, e.clientY];
    if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true;
    cam.x = clamp(cam.x - dx / (U() * cam.zoom * .9), -7, 7); cam.z = clamp(cam.z + dy / (H * .2 * cam.zoom), -1, ROWS - 6);
  });
  const up = e => { ptr.delete(e.pointerId); if (ptr.size < 2) pinch = null; if (!dragged && e.type === 'pointerup') pick(e.clientX * DPR, e.clientY * DPR); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); cam.zoom = clamp(cam.zoom * Math.exp(-e.deltaY * .0012), .45, 2.6); }, { passive: false });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function pick(x, y) { const hit = hits.find(({ box }) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h); if (hit) select(hit.h); else closeCard(); }

  function flyTo(h, zoom = 1.5) { target = { x: h.x, z: h.z - .9, zoom }; }
  function select(h, fly = true) {
    highlight = h; if (fly) flyTo(h);
    $('#cNo').textContent = 'FUQARO #' + String(h.n + 1).padStart(4, '0');
    $('#cNick').textContent = '@' + h.nick; $('#cPlace').textContent = placeOf(h); $('#cStyle').textContent = STYLES[h.style] || h.style;
    $('#cCom').textContent = h.comment ? `💬 "${h.comment}"` : '';
    $('#card').hidden = false;
    history.replaceState(null, '', '?nik=' + encodeURIComponent(h.nick));
  }
  function closeCard() { $('#card').hidden = true; highlight = null; history.replaceState(null, '', location.pathname); }
  const $ = s => document.querySelector(s);
  const toast = m => { const el = $('#toast'); el.textContent = m; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 1800); };
  const norm = s => s.trim().replace(/^@/, '').toLowerCase();

  // search
  const q = $('#q'), sugg = $('#sugg');
  q.addEventListener('input', () => {
    const v = norm(q.value); sugg.innerHTML = '';
    if (!v) { sugg.style.display = 'none'; return; }
    const res = houses.filter(h => h.nick.toLowerCase().includes(v)).slice(0, 6);
    res.forEach(h => { const d = document.createElement('div'); d.textContent = '@' + h.nick; d.onclick = () => { select(h); sugg.style.display = 'none'; q.blur(); }; sugg.appendChild(d); });
    if (!res.length) { const d = document.createElement('div'); d.textContent = 'Topilmadi · uy olish uchun bos 🏠'; d.onclick = () => { $('#modal').hidden = false; sugg.style.display = 'none'; }; sugg.appendChild(d); }
    sugg.style.display = 'block';
  });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = sugg.querySelector('div'); f && f.click(); } });
  $('#rand').onclick = () => select(houses[Math.floor(Math.random() * houses.length)]);
  $('#night').onclick = () => { night = !night; $('#night').textContent = night ? '🌙' : '☀️'; };
  $('#getHouse').onclick = () => $('#modal').hidden = false;
  $('#modalX').onclick = () => $('#modal').hidden = true;
  $('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').hidden = true; };
  $('#cardX').onclick = closeCard;
  $('#zin').onclick = () => cam.zoom = clamp(cam.zoom * 1.25, .45, 2.6);
  $('#zout').onclick = () => cam.zoom = clamp(cam.zoom / 1.25, .45, 2.6);
  $('#home').onclick = () => { target = { x: 0, z: -.2, zoom: 1 }; closeCard(); };
  $('#link').onclick = async () => { const url = location.origin + location.pathname + '?nik=' + encodeURIComponent(highlight.nick); try { await navigator.clipboard.writeText(url); toast('Havola nusxalandi ✅'); } catch { prompt('Havola:', url); } };
  $('#story').onclick = () => storyImage(highlight);

  function chips() {
    const box = $('#chips'), maxM = Math.max(1, mahalla(houses[houses.length - 1]?.z || 0));
    const mk = (txt, fn, on) => { const b = document.createElement('button'); b.className = 'chip' + (on ? ' on' : ''); b.textContent = txt; b.onclick = () => { [...box.children].forEach(c => c.classList.remove('on')); b.classList.add('on'); fn(); }; box.appendChild(b); };
    mk('🆕 Yangi uylar', () => houses.length && select(houses[houses.length - 1]));
    for (let m = 1; m <= Math.max(3, maxM); m++) mk(m + '-Mahalla', () => { target = { x: 0, z: (m - 1) * MAH_ROWS - .2, zoom: 1 }; closeCard(); }, m === 1);
  }

  // story image 1080x1920
  function storyImage(h) {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const g = c.getContext('2d');
    const old = ctx; ctx = g;
    const sky = g.createLinearGradient(0, 0, 0, 1920); sky.addColorStop(0, '#120E3A'); sky.addColorStop(.55, '#3A2470'); sky.addColorStop(1, '#C86A6A'); g.fillStyle = sky; g.fillRect(0, 0, 1080, 1920);
    g.fillStyle = '#FFD35C'; g.beginPath(); g.arc(860, 420, 110, 0, 7); g.fill();
    g.fillStyle = '#2A1E58'; g.beginPath(); g.moveTo(0, 1250); g.lineTo(260, 1080); g.lineTo(520, 1200); g.lineTo(780, 1060); g.lineTo(1080, 1200); g.lineTo(1080, 1920); g.lineTo(0, 1920); g.fill();
    g.fillStyle = '#2F5A3A'; g.fillRect(0, 1380, 1080, 540);
    drawHouse(h.style, 540, 1440, 560, h, true, .4);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = '900 64px Inter, system-ui, sans-serif'; g.fillStyle = '#FFD35C'; g.fillText('XAYOLCHI SHAHRI', 540, 210);
    g.font = '800 40px Inter, system-ui, sans-serif'; g.fillStyle = '#C9C2EA'; g.fillText('FUQARO #' + String(h.n + 1).padStart(4, '0'), 540, 280);
    g.font = '900 96px Inter, system-ui, sans-serif'; g.fillStyle = '#fff'; g.lineWidth = 12; g.strokeStyle = '#14103A'; g.strokeText('@' + h.nick, 540, 560); g.fillText('@' + h.nick, 540, 560);
    g.font = '800 46px Inter, system-ui, sans-serif'; g.fillStyle = '#FFD35C'; g.fillText(STYLES[h.style] || h.style, 540, 640);
    g.font = '700 40px Inter, system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText('Mening uyim Xayolchi shahrida! 🏠', 540, 1620);
    g.fillStyle = '#FFD35C'; g.fillText('@xayolchi.uz', 540, 1690);
    ctx = old;
    c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `xayolchi-${h.nick}.png`; a.click(); toast('Rasm yuklandi 📸'); }, 'image/png');
  }

  // ---------- loop ----------
  function frame(now) {
    if (target) { const e = .08; cam.x += (target.x - cam.x) * e; cam.z += (target.z - cam.z) * e; cam.zoom += (target.zoom - cam.zoom) * e; if (Math.abs(target.x - cam.x) + Math.abs(target.z - cam.z) + Math.abs(target.zoom - cam.zoom) < .002) target = null; }
    draw(now - t0); requestAnimationFrame(frame);
  }
  addEventListener('resize', resize); resize();

  fetch('houses.json?v=' + Date.now()).then(r => r.json()).catch(() => [{ nick: 'xayolchi.uz', style: 'xayolchi', likes: 0, comment: 'Shahar asoschisi' }]).then(list => {
    assign(list); chips();
    const want = new URLSearchParams(location.search).get('nik');
    if (want) { const h = houses.find(h => h.nick.toLowerCase() === norm(want)); if (h) select(h); }
    if (!VIDEO) requestAnimationFrame(frame);
    window.dispatchEvent(new Event('city-ready'));
  });

  // ---------- video API ----------
  window.XV = {
    set(c) { Object.assign(cam, c); }, draw(ms) { draw(ms); }, night(v) { night = v; },
    houses: () => houses, demo(list) { demo = list.map(d => ({ sizeK: 1, seed: hash(d.nick), ...d })); }, highlight(nick) { highlight = houses.find(h => h.nick === nick) || demo.find(h => h.nick === nick) || null; },
    overlay(svg) { document.getElementById('overlay').innerHTML = svg; }
  };
})();
