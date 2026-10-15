/**
 * Films
 * -----
 * The drive-in's programme: four original shorts, drawn live into a canvas
 * (2.35:1), each with its own look, subtitles, score and sound cues.
 *
 *   FILMS[i] = { title, year, look: 'bw' | 'grain' | 'technicolor' | 'cartoon',
 *                score: { bpm, chords, style }, shots: [{ dur, draw, sub? , sfx? }] }
 *   drawFilm(ctx, film, t, w, h)   paints the frame at time t (seconds)
 *   filmCues(film, t0, t1)         sound cues fired between t0 and t1
 *
 * Nothing here is a real movie — they're made for this drive-in.
 */
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Little drawing kit
// ---------------------------------------------------------------------------
function sky(c, w, h, top, bot) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}
function stars(c, w, h, n, seed, a = 1) {
  c.fillStyle = `rgba(255,255,240,${a})`;
  for (let i = 0; i < n; i++) {
    const x = (Math.sin(i * 91.7 + seed) * 0.5 + 0.5) * w;
    const y = (Math.sin(i * 47.3 + seed * 3) * 0.5 + 0.5) * h * 0.6;
    c.fillRect(x, y, 1.5, 1.5);
  }
}
function hills(c, w, h, y, col, amp = 14, f = 0.02, off = 0) {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin(x * f + off) * amp + Math.sin(x * f * 2.7 + off) * amp * 0.4);
  c.lineTo(w, h);
  c.fill();
}
function person(c, x, y, s, col, t = 0, walk = 0, opts = {}) {
  // a simple silhouette figure; walk = 0..1 stride animation
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = col;
  c.strokeStyle = col;
  c.lineWidth = 3;
  c.lineCap = 'round';
  const sw = Math.sin(t * 9) * 0.5 * walk;
  c.beginPath(); // legs
  c.moveTo(0, -18);
  c.lineTo(-5 * sw - 2, 0);
  c.moveTo(0, -18);
  c.lineTo(5 * sw + 2, 0);
  c.stroke();
  c.beginPath(); // body
  if (opts.coat) {
    c.moveTo(-6, -17);
    c.lineTo(6, -17);
    c.lineTo(4, -36);
    c.lineTo(-4, -36);
    c.fill();
  } else c.fillRect(-4, -36, 8, 19);
  c.beginPath(); // arms
  c.moveTo(0, -33);
  c.lineTo(-7 - 3 * sw, -20 + (opts.armUp ? -18 : 0));
  c.moveTo(0, -33);
  c.lineTo(7 + 3 * sw, -20 + (opts.armUp2 ? -18 : 0));
  c.stroke();
  c.beginPath();
  c.arc(0, -41, 5, 0, TAU); // head
  c.fill();
  if (opts.hat) c.fillRect(-7, -47, 14, 3), c.fillRect(-4, -52, 8, 6);
  if (opts.hair) {
    c.beginPath();
    c.arc(0, -42, 6.5, Math.PI, 0);
    c.fill();
    c.fillRect(-6.5, -42, 3, 10);
    c.fillRect(3.5, -42, 3, 10);
  }
  c.restore();
}
function lighthouse(c, x, y, s, lit = 1, t = 0, beam = true) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = '#e8e2d4';
  c.beginPath();
  c.moveTo(-9, 0);
  c.lineTo(9, 0);
  c.lineTo(6, -60);
  c.lineTo(-6, -60);
  c.fill();
  c.fillStyle = '#b03028';
  for (let k = 0; k < 3; k++) c.fillRect(-8 + k * 0.8, -12 - k * 18, 16 - k * 1.6, 7);
  c.fillStyle = '#222';
  c.fillRect(-8, -64, 16, 4);
  c.fillStyle = `rgba(255,240,170,${0.6 + 0.4 * lit})`;
  c.fillRect(-5, -72, 10, 8);
  c.fillStyle = '#222';
  c.beginPath();
  c.moveTo(-7, -72);
  c.lineTo(0, -80);
  c.lineTo(7, -72);
  c.fill();
  if (beam) {
    const a = t * 0.9;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(255,240,180,${0.18 * lit})`;
    c.beginPath();
    c.moveTo(0, -68);
    c.lineTo(Math.cos(a) * 400, -68 + Math.sin(a) * 40 - 12);
    c.lineTo(Math.cos(a) * 400, -68 + Math.sin(a) * 40 + 12);
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}
function sea(c, w, h, y, col, t, foam = '#8aa') {
  c.fillStyle = col;
  c.fillRect(0, y, w, h - y);
  c.strokeStyle = foam;
  c.lineWidth = 1;
  for (let r = 0; r < 6; r++) {
    c.beginPath();
    const yy = y + 4 + r * r * 3;
    for (let x = 0; x <= w; x += 6) c.lineTo(x, yy + Math.sin(x * 0.05 + t * 2 + r) * (1 + r * 0.4));
    c.stroke();
  }
}
function title(c, w, h, text, sub, col = '#fff', font = 'bold 34px Georgia, serif', y = 0.48) {
  c.fillStyle = col;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = font;
  c.fillText(text, w / 2, h * y);
  if (sub) {
    c.font = 'italic 14px Georgia, serif';
    c.fillText(sub, w / 2, h * y + 30);
  }
}
const ease = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.max(0, Math.min(1, k));

// ---------------------------------------------------------------------------
// 1. THE THING FROM ROUTE 9 (1958) — black & white sci-fi
// ---------------------------------------------------------------------------
function saucer(c, x, y, s, t) {
  c.save();
  c.translate(x, y + Math.sin(t * 3) * 2);
  c.scale(s, s);
  c.fillStyle = '#ddd';
  c.beginPath();
  c.ellipse(0, 0, 30, 8, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#999';
  c.beginPath();
  c.ellipse(0, -5, 12, 8, 0, Math.PI, 0);
  c.fill();
  for (let i = 0; i < 6; i++) {
    c.fillStyle = (Math.floor(t * 6) + i) % 2 ? '#fff' : '#555';
    c.fillRect(-25 + i * 10, 1, 4, 3);
  }
  c.restore();
}
const THING = {
  title: 'The Thing from Route 9',
  year: 1958,
  look: 'bw',
  score: { bpm: 70, style: 'theremin', chords: [[0, 3, 7], [1, 4, 8], [-2, 2, 5], [0, 3, 6]] },
  shots: [
    { dur: 7, draw: (c, t, w, h) => { sky(c, w, h, '#050505', '#202020'); stars(c, w, h, 80, 3); title(c, w, h, 'THE THING FROM', null, '#fff', 'bold 30px Georgia, serif', 0.36); title(c, w, h, 'ROUTE 9', null, '#fff', 'bold 52px Georgia, serif', 0.6); }, sfx: [[0.2, 'theremin']] },
    { dur: 9, sub: [[1, 'Pine Hollow. A quiet town. Population: 412.'], [5, 'Until tonight.']], draw: (c, t, w, h) => { sky(c, w, h, '#101010', '#3a3a3a'); stars(c, w, h, 60, 9); hills(c, w, h, h * 0.7, '#181818'); c.fillStyle = '#2a2a2a'; c.fillRect(w * 0.6, h * 0.55, 80, 40); c.fillStyle = '#ddd'; c.fillRect(w * 0.6 + 8, h * 0.6, 16, 10); c.fillRect(w * 0.6 + 50, h * 0.6, 16, 10); c.font = 'bold 10px sans-serif'; c.fillText('DINER', w * 0.6 + 40, h * 0.53); saucer(c, -60 + t * 30, h * 0.2, 0.6, t); } },
    { dur: 10, sub: [[0.5, '"Martha! Martha, come look at the sky!"'], [5, '"Harold, it’s 3 a.m. Go to bed."']], draw: (c, t, w, h) => { sky(c, w, h, '#0c0c0c', '#2c2c2c'); hills(c, w, h, h * 0.78, '#1a1a1a'); person(c, w * 0.42, h * 0.86, 1.7, '#000', t, 0, { hat: true, armUp: t > 1 }); saucer(c, w * 0.6, h * 0.25 + Math.sin(t) * 6, 1.2, t); } , sfx: [[1, 'theremin']] },
    { dur: 10, sub: [[1, 'The saucer lands in Jensen’s corn field.']], draw: (c, t, w, h) => { const k = clamp01(t / 7); sky(c, w, h, '#0c0c0c', '#262626'); hills(c, w, h, h * 0.75, '#141414', 6); c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.moveTo(w * 0.5 - 10, h * 0.2 + k * h * 0.45); c.lineTo(w * 0.5 - 50, h * 0.8); c.lineTo(w * 0.5 + 50, h * 0.8); c.lineTo(w * 0.5 + 10, h * 0.2 + k * h * 0.45); c.fill(); saucer(c, w * 0.5, h * 0.2 + ease(k) * h * 0.45, 1.6, t); }, sfx: [[6.5, 'thump']] },
    { dur: 12, sub: [[0.5, '"Everybody stay calm!"'], [4, '"Nobody is staying calm, Sheriff!"']], draw: (c, t, w, h) => { sky(c, w, h, '#111', '#333'); c.fillStyle = '#1c1c1c'; c.fillRect(0, h * 0.8, w, h); for (let i = 0; i < 6; i++) { const x = ((i * 97 + t * (60 + i * 15)) % (w + 60)) - 30; person(c, x, h * 0.92, 1.3, '#000', t + i, 1, { armUp: true, armUp2: i % 2 === 0 }); } person(c, w * 0.75, h * 0.92, 1.8, '#000', t, 0, { hat: true }); c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(w * 0.75 + 12, h * 0.68); c.lineTo(w * 0.4, h * 0.6); c.lineTo(w * 0.4, h * 0.85); c.fill(); }, sfx: [[0.3, 'crowd']] },
    { dur: 11, sub: [[3, 'The hatch opens...']], draw: (c, t, w, h) => { sky(c, w, h, '#0a0a0a', '#222'); hills(c, w, h, h * 0.8, '#131313', 4); saucer(c, w * 0.5, h * 0.55, 2.4, 0); const k = clamp01((t - 3) / 4); c.fillStyle = `rgba(255,255,255,${0.7 * k})`; c.fillRect(w * 0.5 - 14, h * 0.56, 28, 30 * k); if (t > 6) { c.fillStyle = '#ccc'; const bob = Math.sin(t * 4) * 2; c.beginPath(); c.ellipse(w * 0.5, h * 0.8 + bob, 16, 20, 0, 0, TAU); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(w * 0.5, h * 0.76 + bob, 7, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(w * 0.5 + 2, h * 0.75 + bob, 2.5, 0, TAU); c.fill(); } }, sfx: [[3, 'hiss'], [7, 'theremin']] },
    { dur: 12, sub: [[0.5, '"Wh-what do you want from us?"'], [5, '"...m i l k s h a k e."'], [9, '"...Strawberry?"']], draw: (c, t, w, h) => { sky(c, w, h, '#111', '#2c2c2c'); c.fillStyle = '#1a1a1a'; c.fillRect(0, h * 0.82, w, h); person(c, w * 0.3, h * 0.95, 2.4, '#000', t, 0, { hat: true }); c.fillStyle = '#bbb'; const bob = Math.sin(t * 4) * 2; c.beginPath(); c.ellipse(w * 0.68, h * 0.7 + bob, 26, 34, 0, 0, TAU); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(w * 0.68, h * 0.62 + bob, 11, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(w * 0.68 + 3, h * 0.6 + bob, 4, 0, TAU); c.fill(); } },
    { dur: 12, sub: [[1, 'And so, for one night, Pine Hollow made a new friend.']], draw: (c, t, w, h) => { sky(c, w, h, '#0e0e0e', '#2a2a2a'); c.fillStyle = '#2a2a2a'; c.fillRect(w * 0.2, h * 0.35, w * 0.6, h * 0.5); c.fillStyle = '#ccc'; c.fillRect(w * 0.25, h * 0.45, w * 0.5, h * 0.25); person(c, w * 0.38, h * 0.72, 1.4, '#111', t, 0, { hat: true }); c.fillStyle = '#999'; c.beginPath(); c.ellipse(w * 0.6, h * 0.62, 14, 18, 0, 0, TAU); c.fill(); c.fillStyle = '#eee'; c.fillRect(w * 0.5 - 4, h * 0.58, 8, 14); c.fillStyle = '#000'; c.fillRect(w * 0.5 - 1, h * 0.5, 2, 9); } },
    { dur: 8, draw: (c, t, w, h) => { sky(c, w, h, '#000', '#111'); stars(c, w, h, 90, 5); saucer(c, w * 0.5 + t * 50, h * 0.3 - t * 6, 0.8, t); title(c, w, h, 'THE END', t > 4 ? '...?' : null, '#fff', 'bold 40px Georgia, serif', 0.62); }, sfx: [[0.1, 'theremin']] },
  ],
};

// ---------------------------------------------------------------------------
// 2. FOG (1981) — grainy horror, nothing gory
// ---------------------------------------------------------------------------
function fogLayer(c, w, h, t, a = 0.5) {
  for (let i = 0; i < 5; i++) {
    const y = h * (0.45 + i * 0.1);
    const g = c.createLinearGradient(0, y - 30, 0, y + 30);
    g.addColorStop(0, 'rgba(160,170,180,0)');
    g.addColorStop(0.5, `rgba(160,170,180,${a * 0.35})`);
    g.addColorStop(1, 'rgba(160,170,180,0)');
    c.fillStyle = g;
    c.fillRect(-20 + Math.sin(t * 0.3 + i) * 20, y - 30, w + 40, 60);
  }
}
function raincoat(c, x, y, s, t, walk) {
  person(c, x, y, s, '#c8a020', t, walk, { coat: true, hat: true });
  // lantern
  c.fillStyle = 'rgba(255,200,90,0.9)';
  c.beginPath();
  c.arc(x + 9 * s, y - 20 * s, 3 * s, 0, TAU);
  c.fill();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x + 9 * s, y - 20 * s, 0, x + 9 * s, y - 20 * s, 40 * s);
  g.addColorStop(0, 'rgba(255,180,80,0.35)');
  g.addColorStop(1, 'rgba(255,180,80,0)');
  c.fillStyle = g;
  c.fillRect(x - 40 * s, y - 60 * s, 100 * s, 80 * s);
  c.globalCompositeOperation = 'source-over';
}
const FOG = {
  title: 'FOG',
  year: 1981,
  look: 'grain',
  score: { bpm: 54, style: 'synth-horror', chords: [[0, 3, 7], [0, 3, 8], [-1, 2, 7], [0, 3, 6]] },
  shots: [
    { dur: 7, draw: (c, t, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); title(c, w, h, 'F O G', null, `rgba(200,30,30,${clamp01(t / 2)})`, 'bold 56px Impact, sans-serif'); }, sfx: [[0.3, 'drone']] },
    { dur: 11, sub: [[1, 'Route 9. 2:47 a.m.'], [6, '"Must be the fog. Radio’s just static."']], draw: (c, t, w, h) => { sky(c, w, h, '#0a0e14', '#3a4450'); c.fillStyle = '#1a1a1e'; c.beginPath(); c.moveTo(w * 0.45, h * 0.55); c.lineTo(w * 0.55, h * 0.55); c.lineTo(w, h); c.lineTo(0, h); c.fill(); c.strokeStyle = '#c8c070'; c.setLineDash([12, 14]); c.lineDashOffset = -t * 60; c.beginPath(); c.moveTo(w / 2, h * 0.56); c.lineTo(w / 2, h); c.stroke(); c.setLineDash([]); fogLayer(c, w, h, t, 0.8); c.fillStyle = 'rgba(255,240,200,0.12)'; c.beginPath(); c.moveTo(w * 0.3, h); c.lineTo(w * 0.47, h * 0.58); c.lineTo(w * 0.53, h * 0.58); c.lineTo(w * 0.7, h); c.fill(); }, sfx: [[0, 'engine'], [5, 'static']] },
    { dur: 10, sub: [[2, '"...Is someone there?"']], draw: (c, t, w, h) => { sky(c, w, h, '#0a0c10', '#30383e'); fogLayer(c, w, h, t, 0.9); raincoat(c, w * 0.62, h * 0.85, 1.6, t, 0); }, sfx: [[1.5, 'sting']] },
    { dur: 12, sub: [[4, 'She ran.']], draw: (c, t, w, h) => { sky(c, w, h, '#06080a', '#1e2428'); for (let i = 0; i < 9; i++) { const x = ((i * 70 - t * 120) % (w + 80) + w + 80) % (w + 80) - 40; c.fillStyle = '#0b0f0c'; c.fillRect(x, 0, 12, h); } person(c, w * 0.45, h * 0.92, 1.8, '#d8d0c8', t, 1, { hair: true }); fogLayer(c, w, h, t, 0.6); raincoat(c, w * 0.08 + Math.sin(t) * 6, h * 0.92, 1.3, t, 0.6); }, sfx: [[0.2, 'heartbeat'], [6, 'heartbeat']] },
    { dur: 10, sub: [[1, 'The lighthouse.'], [5, '"Please be open. Please be open."']], draw: (c, t, w, h) => { sky(c, w, h, '#0a0e14', '#2a3440'); sea(c, w, h, h * 0.72, '#0c1418', t, '#3a4a50'); c.fillStyle = '#141614'; c.fillRect(w * 0.55, h * 0.6, w * 0.45, h); lighthouse(c, w * 0.75, h * 0.62, 1.2, 1, t); fogLayer(c, w, h, t, 0.7); person(c, w * 0.6, h * 0.72, 0.8, '#d8d0c8', t, 1, { hair: true }); } },
    { dur: 12, sub: [[0.5, 'Knock. Knock.'], [4, 'The door opens.'], [8, '"...Have you seen my dog?"']], draw: (c, t, w, h) => { c.fillStyle = '#0e0c0a'; c.fillRect(0, 0, w, h); const k = clamp01((t - 4) / 2); c.fillStyle = `rgba(255,190,110,${0.85 * k})`; c.fillRect(w * 0.42, h * 0.15, w * 0.16 * k, h * 0.75); if (t > 5) raincoat(c, w * 0.5, h * 0.9, 2.6, t, 0); person(c, w * 0.2, h * 0.98, 2.8, '#000', t, 0, { hair: true }); }, sfx: [[0.5, 'knock'], [1.5, 'knock'], [4, 'creak']] },
    { dur: 10, sub: [[1, 'It was just Ray, the keeper. Looking for Biscuit.'], [6, 'Biscuit was fine.']], draw: (c, t, w, h) => { sky(c, w, h, '#1a1c22', '#4a5058'); sea(c, w, h, h * 0.75, '#1a2428', t); lighthouse(c, w * 0.8, h * 0.7, 1, 1, t); raincoat(c, w * 0.4, h * 0.9, 1.6, t, 0.3); person(c, w * 0.5, h * 0.9, 1.6, '#d8d0c8', t, 0.3, { hair: true }); c.fillStyle = '#8a5a2a'; const dx = w * 0.3 + Math.sin(t * 3) * 20; c.fillRect(dx, h * 0.86, 18, 9); c.fillRect(dx + 14, h * 0.82, 7, 7); }, sfx: [[2, 'bark']] },
    { dur: 7, draw: (c, t, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); title(c, w, h, 'THE END', null, '#c82020', 'bold 40px Impact, sans-serif'); }, sfx: [[0.2, 'drone']] },
  ],
};

// ---------------------------------------------------------------------------
// 3. THE KEEPER'S DAUGHTER (1946) — technicolor romance
// ---------------------------------------------------------------------------
const KEEPER = {
  title: "The Keeper's Daughter",
  year: 1946,
  look: 'technicolor',
  score: { bpm: 66, style: 'strings', chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]] },
  shots: [
    { dur: 8, draw: (c, t, w, h) => { sky(c, w, h, '#2a1a3a', '#e07a4a'); sea(c, w, h, h * 0.7, '#3a3a6a', t, '#e8a07a'); title(c, w, h, "The Keeper's Daughter", 'in Glorious Technicolor', '#ffe8c0', 'italic bold 32px Georgia, serif', 0.38); } },
    { dur: 11, sub: [[1, 'Every evening, Eleanor lit the lamp.'], [6, 'And every evening, a boat came in a little late.']], draw: (c, t, w, h) => { sky(c, w, h, '#3a2a5a', '#f09060'); const sun = h * 0.66 + t * 2; c.fillStyle = '#ffd890'; c.beginPath(); c.arc(w * 0.3, sun, 22, 0, TAU); c.fill(); sea(c, w, h, h * 0.68, '#2a3a6a', t, '#f0b080'); c.fillStyle = '#2a1a1a'; c.fillRect(w * 0.6, h * 0.55, w * 0.4, h); lighthouse(c, w * 0.8, h * 0.56, 1.1, clamp01(t / 4), t, t > 4); c.fillStyle = '#1a1a2a'; c.beginPath(); c.moveTo(w * 0.1 + t * 6, h * 0.72); c.lineTo(w * 0.17 + t * 6, h * 0.72); c.lineTo(w * 0.15 + t * 6, h * 0.75); c.lineTo(w * 0.12 + t * 6, h * 0.75); c.fill(); c.fillRect(w * 0.135 + t * 6, h * 0.62, 1.5, 10); } },
    { dur: 12, sub: [[0.5, '"You’re late again, Thomas."'], [5, '"The fish don’t keep hours, Ellie."'], [9, '"Neither do I."']], draw: (c, t, w, h) => { sky(c, w, h, '#4a2a5a', '#e88a5a'); c.fillStyle = '#5a3a2a'; c.fillRect(0, h * 0.78, w, h); person(c, w * 0.42, h * 0.92, 2.2, '#2a1a3a', t, 0, { hair: true }); person(c, w * 0.6, h * 0.92, 2.3, '#1a2a3a', t, 0, { hat: true }); } },
    { dur: 11, sub: [[1, 'Then came the storm of ’46.'], [6, 'Thomas’s boat didn’t come in.']], draw: (c, t, w, h) => { sky(c, w, h, '#1a1e2e', '#3a4058'); if (Math.floor(t * 3) % 7 === 0) { c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(0, 0, w, h); } sea(c, w, h, h * 0.64 + Math.sin(t * 2) * 4, '#1a2a3a', t * 2, '#9ab'); c.strokeStyle = 'rgba(200,210,230,0.35)'; for (let i = 0; i < 70; i++) { const x = (i * 37 + t * 200) % w; const y = (i * 23 + t * 400) % h; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 4, y + 12); c.stroke(); } lighthouse(c, w * 0.85, h * 0.62, 1, 1, t * 1.5); }, sfx: [[0.5, 'thunder'], [6, 'thunder']] },
    { dur: 11, sub: [[1, 'She kept the light burning all night.'], [6, 'She didn’t sleep.']], draw: (c, t, w, h) => { c.fillStyle = '#2a1a14'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd890'; c.beginPath(); c.arc(w / 2, h * 0.4, 30, 0, TAU); c.fill(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, 150); g.addColorStop(0, 'rgba(255,200,120,0.5)'); g.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; person(c, w * 0.3, h, 3, '#140a0a', t, 0, { hair: true }); } },
    { dur: 12, sub: [[2, 'At dawn, a sail.'], [7, '"I told you. The fish don’t keep hours."']], draw: (c, t, w, h) => { sky(c, w, h, '#f0a0a0', '#ffe0b0'); c.fillStyle = '#fff4d0'; c.beginPath(); c.arc(w * 0.5, h * 0.66, 30, Math.PI, 0); c.fill(); sea(c, w, h, h * 0.66, '#5a7aa8', t, '#ffe'); const bx = w * 0.2 + t * 14; c.fillStyle = '#3a2a2a'; c.fillRect(bx, h * 0.7, 30, 6); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(bx + 15, h * 0.48); c.lineTo(bx + 15, h * 0.7); c.lineTo(bx + 30, h * 0.7); c.fill(); } },
    { dur: 10, draw: (c, t, w, h) => { sky(c, w, h, '#2a1a3a', '#c86a4a'); sea(c, w, h, h * 0.75, '#2a2a5a', t, '#e8a07a'); lighthouse(c, w * 0.8, h * 0.72, 1.1, 1, t); person(c, w * 0.47, h * 0.75, 1.4, '#140a14', t, 0, { hair: true }); person(c, w * 0.52, h * 0.75, 1.5, '#140a14', t, 0, { hat: true }); if (t > 5) title(c, w, h, 'Fin', null, `rgba(255,230,190,${clamp01((t - 5) / 2)})`, 'italic 40px Georgia, serif', 0.35); } },
  ],
};

// ---------------------------------------------------------------------------
// 4. MIDNIGHT SNACK — rubber-hose cartoon
// ---------------------------------------------------------------------------
function cat(c, x, y, s, t, sneak = 0) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  const b = Math.sin(t * 10) * 2 * sneak;
  c.fillStyle = '#111';
  c.beginPath();
  c.ellipse(0, -14 + b, 14, 10, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.arc(14, -24 + b, 8, 0, TAU);
  c.fill();
  c.beginPath();
  c.moveTo(9, -30 + b);
  c.lineTo(11, -38 + b);
  c.lineTo(14, -31 + b);
  c.moveTo(16, -31 + b);
  c.lineTo(19, -38 + b);
  c.lineTo(21, -29 + b);
  c.fill();
  c.strokeStyle = '#111';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-13, -16 + b);
  c.quadraticCurveTo(-26, -30 + Math.sin(t * 4) * 6, -20, -40);
  c.stroke();
  c.fillStyle = '#fff';
  c.beginPath();
  c.ellipse(16, -25 + b, 3, 4, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#000';
  c.fillRect(16, -25 + b, 1.5, 2.5);
  for (const lx of [-8, -2, 4, 10]) {
    c.fillRect(lx, -6, 3, 6 + Math.sin(t * 12 + lx) * 2 * sneak);
  }
  c.restore();
}
function dog(c, x, y, s, t, run = 0, sleep = false) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  const b = Math.sin(t * 14) * 3 * run;
  c.fillStyle = '#e8d8b8';
  c.beginPath();
  c.ellipse(0, -16 + b, 18, 12, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.arc(20, -26 + b, 10, 0, TAU);
  c.fill();
  c.fillStyle = '#6a4a2a';
  c.beginPath();
  c.ellipse(14, -26 + b, 4, 9, 0.3, 0, TAU);
  c.fill();
  c.fillStyle = '#000';
  if (sleep) c.fillRect(21, -28, 6, 1.5);
  else c.fillRect(22, -30 + b, 3, 3);
  c.beginPath();
  c.arc(30, -24 + b, 2.5, 0, TAU);
  c.fill();
  c.fillStyle = '#e8d8b8';
  for (const lx of [-12, -5, 6, 12]) c.fillRect(lx, -6, 4, 6 + Math.sin(t * 16 + lx) * 3 * run);
  c.restore();
}
function pie(c, x, y, s) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = '#e8b060';
  c.beginPath();
  c.ellipse(0, 0, 16, 6, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#c84a6a';
  c.beginPath();
  c.ellipse(0, -2, 13, 4, 0, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(-6 + i * 6, -6);
    c.quadraticCurveTo(-3 + i * 6, -14, -6 + i * 6, -20);
    c.lineWidth = 1.5;
    c.strokeStyle = c.fillStyle;
    c.stroke();
  }
  c.restore();
}
function kitchen(c, w, h) {
  c.fillStyle = '#f4e4a8';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#d84a3a';
  for (let x = 0; x < w; x += 20) for (let y = h * 0.78; y < h; y += 20) if (((x + y) / 20) % 2 < 1) c.fillRect(x, y, 20, 20);
  c.fillStyle = '#fff8e8';
  c.fillRect(0, h * 0.78, w, 2);
}
const SNACK = {
  title: 'Midnight Snack',
  year: 1934,
  look: 'cartoon',
  score: { bpm: 132, style: 'ragtime', chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]] },
  shots: [
    { dur: 6, draw: (c, t, w, h) => { c.fillStyle = '#ffe070'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e84a2a'; c.lineWidth = 6; for (let r = 0; r < 12; r++) { c.beginPath(); c.arc(w / 2, h / 2, 30 + r * 26 + (t * 40) % 26, 0, TAU); c.stroke(); } title(c, w, h, 'MIDNIGHT SNACK', 'a Pine Hollow Cartoon', '#1a1a1a', 'bold 40px "Cooper Black", Georgia, serif'); } },
    { dur: 10, sub: [[1, '(tiptoe... tiptoe...)']], draw: (c, t, w, h) => { kitchen(c, w, h); c.fillStyle = '#c8d8e8'; c.fillRect(w * 0.72, h * 0.25, 70, h * 0.53); c.fillStyle = '#888'; c.fillRect(w * 0.72 + 6, h * 0.5, 4, 14); dog(c, w * 0.15, h * 0.86, 1.6, t, 0, true); c.fillStyle = '#000'; c.font = '14px Georgia'; c.fillText('z', w * 0.24, h * 0.58 - (t * 8) % 20); cat(c, w * 0.3 + t * 20, h * 0.86, 1.6, t, 1); }, sfx: [[0.3, 'tiptoe'], [4, 'tiptoe']] },
    { dur: 9, sub: [[3, '!!!']], draw: (c, t, w, h) => { kitchen(c, w, h); c.fillStyle = '#c8d8e8'; c.fillRect(w * 0.6, h * 0.25, 70, h * 0.53); const open = clamp01(t / 2); c.fillStyle = '#fffbe0'; c.fillRect(w * 0.6, h * 0.25, 70 * open, h * 0.53); if (open > 0.5) pie(c, w * 0.6 + 35, h * 0.5, 1.5); cat(c, w * 0.45, h * 0.86, 1.9, t, t < 2 ? 1 : 0); if (t > 3) { c.fillStyle = '#000'; c.font = 'bold 30px Georgia'; c.fillText('♥', w * 0.48, h * 0.4 - (t - 3) * 10); } }, sfx: [[0.3, 'creak'], [3, 'boing']] },
    { dur: 12, sub: [[2, 'WOOF!']], draw: (c, t, w, h) => { kitchen(c, w, h); const run = t > 2 ? 1 : 0; const cx = run ? ((w * 0.5 + (t - 2) * 160) % (w + 80)) - 40 : w * 0.5; cat(c, cx, h * 0.86, 1.7, t, run); pie(c, cx + 20, h * 0.66, 1.1); if (t > 2) dog(c, cx - 90, h * 0.86, 1.7, t, 1); else dog(c, w * 0.1, h * 0.86, 1.6, t, 0, false); }, sfx: [[2, 'bark'], [2.6, 'zip'], [6, 'crash'], [9, 'zip']] },
    { dur: 10, sub: [[1, '...'], [5, 'Share?']], draw: (c, t, w, h) => { kitchen(c, w, h); cat(c, w * 0.38, h * 0.86, 1.8, t, 0); dog(c, w * 0.62, h * 0.86, -1.8, t, 0); pie(c, w * 0.5, h * 0.8, 1.6); if (t > 5) { c.fillStyle = '#e84a6a'; c.font = 'bold 26px Georgia'; c.textAlign = 'center'; c.fillText('♥', w * 0.5, h * 0.45); } }, sfx: [[6, 'boing']] },
    { dur: 7, draw: (c, t, w, h) => { kitchen(c, w, h); cat(c, w * 0.42, h * 0.86, 1.6, t, 0); dog(c, w * 0.58, h * 0.86, -1.6, t, 0, true); const r = Math.max(0, 1 - t / 4) * w; c.fillStyle = '#000'; c.beginPath(); c.rect(0, 0, w, h); c.arc(w / 2, h / 2, r, 0, TAU, true); c.fill(); if (t > 4) title(c, w, h, "That's all, folks of Pine Hollow!", null, '#ffe070', 'bold 20px Georgia, serif'); } },
  ],
};

export const FILMS = [THING, FOG, KEEPER, SNACK];
for (const f of FILMS) f.duration = f.shots.reduce((s, sh) => s + sh.dur, 0);

/** Intermission card between features. */
export const INTERMISSION = 18;
export function drawIntermission(c, t, w, h, next) {
  c.fillStyle = '#1a0a2a';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#ffd850';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = 'bold 26px Georgia, serif';
  c.fillText("Let's all go to the lobby!", w / 2, h * 0.2);
  // dancing popcorn + soda
  for (let i = 0; i < 3; i++) {
    const x = w * (0.3 + i * 0.2);
    const y = h * 0.6 + Math.abs(Math.sin(t * 5 + i)) * -14;
    c.fillStyle = '#fff';
    c.fillRect(x - 14, y - 10, 28, 30);
    c.fillStyle = '#e83a3a';
    for (let k = 0; k < 4; k++) c.fillRect(x - 14 + k * 8, y - 10, 4, 30);
    c.fillStyle = '#fff8d0';
    for (let k = 0; k < 5; k++) {
      c.beginPath();
      c.arc(x - 10 + k * 5, y - 12 - (k % 2) * 4, 5, 0, TAU);
      c.fill();
    }
    c.fillStyle = '#000';
    c.fillRect(x - 6, y + 2, 3, 3);
    c.fillRect(x + 3, y + 2, 3, 3);
  }
  c.fillStyle = '#c8b8e8';
  c.font = 'italic 14px Georgia, serif';
  c.fillText(`Next: "${next.title}" (${next.year})`, w / 2, h * 0.9);
}

/** Paint one frame of `film` at time t (seconds) with its period look. */
export function drawFilm(c, film, t, w, h) {
  let acc = 0;
  let shot = film.shots[0];
  let st = t;
  for (const s of film.shots) {
    if (t < acc + s.dur) {
      shot = s;
      st = t - acc;
      break;
    }
    acc += s.dur;
  }
  c.save();
  // gate weave
  if (film.look !== 'cartoon') c.translate(Math.sin(t * 13) * 0.6, Math.sin(t * 7.3) * 0.8);
  shot.draw(c, st, w, h);
  c.restore();
  // fade in/out at shot boundaries
  const edge = Math.min(st, shot.dur - st);
  if (edge < 0.5) {
    c.fillStyle = `rgba(0,0,0,${1 - edge / 0.5})`;
    c.fillRect(0, 0, w, h);
  }
  // subtitles
  const sub = (shot.sub ?? []).filter(([s0]) => st >= s0).at(-1);
  if (sub && st - sub[0] < 4.5) {
    c.font = '15px Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(0,0,0,0.85)';
    c.strokeText(sub[1], w / 2, h - 12);
    c.fillStyle = film.look === 'cartoon' ? '#fff' : '#fffbe8';
    c.fillText(sub[1], w / 2, h - 12);
  }
  post(c, film.look, t, w, h);
}

/** Period look: B&W, grain, scratches, colour grading. */
function post(c, look, t, w, h) {
  if (look === 'bw' || look === 'grain' || look === 'technicolor') {
    const img = c.getImageData(0, 0, w, h);
    const d = img.data;
    const seed = Math.floor(t * 24);
    for (let i = 0; i < d.length; i += 4) {
      const n = ((((i * 1103515245 + seed * 12345) >>> 0) % 1000) / 1000 - 0.5) * (look === 'grain' ? 46 : 24);
      if (look === 'bw') {
        const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 + n;
        d[i] = d[i + 1] = d[i + 2] = l;
      } else if (look === 'technicolor') {
        d[i] = Math.min(255, d[i] * 1.12 + n);
        d[i + 1] = d[i + 1] * 0.96 + n;
        d[i + 2] = d[i + 2] * 1.04 + n;
      } else {
        d[i] += n;
        d[i + 1] += n * 0.9;
        d[i + 2] += n * 1.1;
      }
    }
    c.putImageData(img, 0, 0);
    // scratches + dust
    c.fillStyle = 'rgba(255,255,255,0.35)';
    if ((Math.floor(t * 24) * 7) % 11 < 3) c.fillRect(((t * 9301) % 1) * w, 0, 1, h);
    c.fillStyle = 'rgba(0,0,0,0.6)';
    for (let k = 0; k < 3; k++) {
      const x = ((Math.sin(t * 50 + k * 3) * 0.5 + 0.5) * w) | 0;
      const y = ((Math.cos(t * 37 + k) * 0.5 + 0.5) * h) | 0;
      c.fillRect(x, y, 2, 2);
    }
  }
  // flicker
  if (look !== 'cartoon') {
    c.fillStyle = `rgba(0,0,0,${0.04 + 0.04 * Math.sin(t * 31)})`;
    c.fillRect(0, 0, w, h);
  }
}

/** Sound cues whose time falls in (t0, t1]. */
export function filmCues(film, t0, t1) {
  const out = [];
  let acc = 0;
  for (const s of film.shots) {
    for (const [ct, key] of s.sfx ?? []) {
      const at = acc + ct;
      if (at > t0 && at <= t1) out.push(key);
    }
    acc += s.dur;
  }
  return out;
}
