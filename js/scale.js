// Things of known size, from the Earth–Moon distance down to a proton, each with a small drawing. The wave view
// picks the one that best fits beside the current wavelength so the scale can be felt.
// Sizes: NASA planetary fact sheets; buildings and objects from their owners' published figures; cells and
// molecules typical values; the proton's charge radius (CODATA 2018, 0.84 fm) doubled.

const TAU = Math.PI * 2;
function disc(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }

const body = (fill, rim, extra) => (ctx, s) => {
  const g = ctx.createRadialGradient(-s * 0.15, -s * 0.15, s * 0.05, 0, 0, s / 2);
  g.addColorStop(0, fill[0]); g.addColorStop(1, fill[1]);
  disc(ctx, 0, 0, s / 2, g);
  if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = Math.max(1, s * 0.02); ctx.stroke(); }
  extra?.(ctx, s);
};
const pair = (a, b) => (ctx, s) => {
  ctx.strokeStyle = 'rgba(230,235,243,0.5)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-s / 2, 0); ctx.lineTo(s / 2, 0); ctx.stroke(); ctx.setLineDash([]);
  disc(ctx, -s / 2, 0, 5, a); disc(ctx, s / 2, 0, 4, b);
};

export const OBJECTS = [
  { name: 'Earth to the Moon', m: 3.844e8, along: true, draw: pair('#5b9bd5', '#c9c9c9') },
  { name: 'Jupiter', m: 1.3982e8, draw: body(['#e6c39a', '#9a6a44'], null, (ctx, s) => {
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(120,70,40,0.35)';
    for (const y of [-0.28, -0.1, 0.12, 0.3]) ctx.fillRect(-s / 2, y * s, s, s * 0.05);
    ctx.restore(); }) },
  { name: 'Neptune', m: 4.9528e7, draw: body(['#7fb2f0', '#2b4f9a']) },
  { name: 'The Earth', m: 1.2742e7, draw: body(['#6fb0e8', '#1d4f86'], 'rgba(150,200,255,0.5)', (ctx, s) => {
    ctx.fillStyle = 'rgba(90,150,80,0.75)';
    ctx.beginPath(); ctx.ellipse(-s * 0.12, -s * 0.08, s * 0.16, s * 0.22, 0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.17, s * 0.12, s * 0.1, s * 0.15, -0.3, 0, TAU); ctx.fill(); }) },
  { name: 'The Moon', m: 3.4748e6, draw: body(['#d6d6d6', '#7a7a7a'], null, (ctx, s) => {
    for (const [x, y, r] of [[-0.15, -0.1, 0.08], [0.12, 0.05, 0.06], [-0.02, 0.2, 0.05], [0.18, -0.18, 0.04]]) disc(ctx, x * s, y * s, r * s, 'rgba(90,90,90,0.4)'); }) },
  { name: 'London to Edinburgh', m: 5.34e5, along: true, draw: pair('#f2b45a', '#f2b45a') },
  { name: 'A marathon', m: 42195, along: true, draw: pair('#8ef0b0', '#8ef0b0') },
  { name: 'Mount Everest', m: 8849, tall: true, draw: (ctx, s) => {
    ctx.beginPath(); ctx.moveTo(-s * 0.9, s / 2); ctx.lineTo(-s * 0.1, -s / 2); ctx.lineTo(s * 0.15, -s * 0.2); ctx.lineTo(s * 0.3, -s * 0.3); ctx.lineTo(s * 0.9, s / 2); ctx.closePath();
    ctx.fillStyle = '#6b7488'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s * 0.33, -s * 0.2); ctx.lineTo(-s * 0.1, -s / 2); ctx.lineTo(s * 0.1, -s * 0.25); ctx.lineTo(-s * 0.05, -s * 0.15); ctx.closePath();
    ctx.fillStyle = '#e8edf5'; ctx.fill(); } },
  { name: 'Burj Khalifa', m: 828, tall: true, draw: (ctx, s) => {
    ctx.fillStyle = '#9fb0c8';
    for (const [w, h] of [[0.16, 1], [0.11, 0.8], [0.07, 0.6], [0.04, 0.42], [0.012, 0.3]]) ctx.fillRect(-w * s / 2, s / 2 - h * s * (h === 0.3 ? 3.3 : 1), w * s, h * s * (h === 0.3 ? 3.3 : 1));
  } },
  { name: 'The Eiffel Tower', m: 330, tall: true, draw: (ctx, s) => {
    ctx.strokeStyle = '#b08a5a'; ctx.lineWidth = Math.max(1, s * 0.015); ctx.fillStyle = '#b08a5a';
    ctx.beginPath(); ctx.moveTo(-s * 0.25, s / 2); ctx.quadraticCurveTo(-s * 0.06, 0, -s * 0.02, -s / 2); ctx.lineTo(s * 0.02, -s / 2); ctx.quadraticCurveTo(s * 0.06, 0, s * 0.25, s / 2);
    ctx.lineTo(s * 0.15, s / 2); ctx.quadraticCurveTo(0, s * 0.3, -s * 0.15, s / 2); ctx.closePath(); ctx.fill();
    ctx.fillRect(-s * 0.13, s * 0.18, s * 0.26, s * 0.025); ctx.fillRect(-s * 0.07, -s * 0.08, s * 0.14, s * 0.02); } },
  { name: 'A football pitch', m: 105, draw: (ctx, s) => {
    const h = s * 0.65; ctx.fillStyle = '#2f6b3a'; ctx.fillRect(-s / 2, -h / 2, s, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, s * 0.008);
    ctx.strokeRect(-s / 2, -h / 2, s, h); ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.087, 0, TAU); ctx.stroke();
    ctx.strokeRect(-s / 2, -h * 0.3, s * 0.157, h * 0.6); ctx.strokeRect(s / 2 - s * 0.157, -h * 0.3, s * 0.157, h * 0.6); } },
  { name: 'A blue whale', m: 25, draw: (ctx, s) => {
    ctx.fillStyle = '#5d7ea6'; ctx.beginPath(); ctx.moveTo(-s / 2, 0); ctx.quadraticCurveTo(-s * 0.4, -s * 0.12, 0, -s * 0.1);
    ctx.quadraticCurveTo(s * 0.3, -s * 0.07, s * 0.42, -s * 0.01); ctx.lineTo(s / 2, -s * 0.08); ctx.lineTo(s * 0.47, 0.02 * s); ctx.lineTo(s / 2, s * 0.08);
    ctx.lineTo(s * 0.42, s * 0.02); ctx.quadraticCurveTo(0, s * 0.1, -s / 2, 0); ctx.fill(); } },
  { name: 'A double-decker bus', m: 11.2, draw: (ctx, s) => {
    const h = s * 0.39; ctx.fillStyle = '#c8323c'; ctx.beginPath(); ctx.roundRect(-s / 2, -h / 2, s, h * 0.9, s * 0.03); ctx.fill();
    ctx.fillStyle = 'rgba(200,230,255,0.7)';
    for (const row of [-0.36, 0.02]) for (let i = 0; i < 6; i++) ctx.fillRect(-s * 0.44 + i * s * 0.15, row * h, s * 0.12, h * 0.22);
    disc(ctx, -s * 0.3, h * 0.42, s * 0.05, '#222'); disc(ctx, s * 0.3, h * 0.42, s * 0.05, '#222'); } },
  { name: 'A person', m: 1.7, tall: true, draw: (ctx, s) => {
    ctx.fillStyle = '#c9b8a6'; disc(ctx, 0, -s * 0.43, s * 0.065, '#c9b8a6');
    ctx.beginPath(); ctx.roundRect(-s * 0.1, -s * 0.35, s * 0.2, s * 0.42, s * 0.05); ctx.fill();
    ctx.fillRect(-s * 0.09, 0, s * 0.075, s / 2); ctx.fillRect(s * 0.015, 0, s * 0.075, s / 2);
    ctx.fillRect(-s * 0.15, -s * 0.33, s * 0.05, s * 0.33); ctx.fillRect(s * 0.1, -s * 0.33, s * 0.05, s * 0.33); } },
  { name: 'A phone', m: 0.147, tall: true, draw: (ctx, s) => {
    ctx.fillStyle = '#2a3140'; ctx.beginPath(); ctx.roundRect(-s * 0.24, -s / 2, s * 0.48, s, s * 0.06); ctx.fill();
    ctx.fillStyle = '#4b6b9a'; ctx.beginPath(); ctx.roundRect(-s * 0.21, -s * 0.46, s * 0.42, s * 0.92, s * 0.04); ctx.fill(); } },
  { name: 'A £1 coin', m: 0.02343, draw: body(['#e8cf7a', '#9c7a2c'], 'rgba(200,200,210,0.9)') },
  { name: 'An ant', m: 0.005, draw: (ctx, s) => {
    ctx.fillStyle = '#3b2a20';
    for (const [x, r] of [[-0.32, 0.17], [0, 0.1], [0.3, 0.13]]) { ctx.beginPath(); ctx.ellipse(x * s, 0, r * s, r * s * 0.75, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#3b2a20'; ctx.lineWidth = Math.max(1, s * 0.015);
    for (const d of [-1, 1]) for (const x of [-0.06, 0, 0.06]) { ctx.beginPath(); ctx.moveTo(x * s, 0); ctx.lineTo((x * 2.5) * s, d * s * 0.3); ctx.stroke(); } } },
  { name: 'A grain of sand', m: 5e-4, draw: body(['#e2c48e', '#a07c44']) },
  { name: 'The width of a hair', m: 8e-5, tall: true, draw: (ctx, s) => {
    const g = ctx.createLinearGradient(-s / 2, 0, s / 2, 0); g.addColorStop(0, '#3a2a1c'); g.addColorStop(0.5, '#7a5a3c'); g.addColorStop(1, '#3a2a1c');
    ctx.fillStyle = g; ctx.fillRect(-s / 2, -s * 2, s, s * 4); } },
  { name: 'A red blood cell', m: 8e-6, draw: body(['#ff8a8a', '#a3202a'], null, (ctx, s) => disc(ctx, 0, 0, s * 0.18, 'rgba(120,10,20,0.35)')) },
  { name: 'A bacterium', m: 2e-6, draw: (ctx, s) => {
    ctx.fillStyle = '#7fbf6a'; ctx.beginPath(); ctx.roundRect(-s / 2, -s * 0.15, s, s * 0.3, s * 0.15); ctx.fill();
    ctx.strokeStyle = 'rgba(127,191,106,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s / 2, 0);
    for (let i = 1; i < 12; i++) ctx.lineTo(s / 2 + i * s * 0.05, Math.sin(i) * s * 0.06); ctx.stroke(); } },
  { name: 'A giant virus (mimivirus)', m: 5e-7, draw: spiky('#8fae7a') },
  { name: 'A flu virus', m: 1e-7, draw: spiky('#b48ad6') },
  { name: 'A ribosome', m: 2.5e-8, draw: (ctx, s) => { disc(ctx, 0, s * 0.1, s * 0.4, '#d6a35a'); disc(ctx, s * 0.05, -s * 0.28, s * 0.25, '#e8c27a'); } },
  { name: 'A haemoglobin protein', m: 5.5e-9, draw: (ctx, s) => {
    for (const [x, y, c] of [[-0.18, -0.18, '#d65a5a'], [0.18, -0.18, '#c04a6a'], [-0.18, 0.18, '#c04a6a'], [0.18, 0.18, '#d65a5a']]) disc(ctx, x * s, y * s, s * 0.24, c); } },
  { name: 'The width of DNA', m: 2e-9, tall: true, draw: (ctx, s) => {
    ctx.lineWidth = Math.max(1, s * 0.08);
    for (const [ph, c] of [[0, '#7cc4ff'], [Math.PI, '#e58cff']]) {
      ctx.strokeStyle = c; ctx.beginPath();
      for (let i = 0; i <= 60; i++) { const y = -s * 2 + (i / 60) * s * 4; const x = Math.sin(i / 60 * TAU * 1.2 + ph) * s / 2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    } } },
  { name: 'A water molecule', m: 2.8e-10, draw: (ctx, s) => {
    disc(ctx, 0, -s * 0.05, s * 0.3, '#e25a5a'); disc(ctx, -s * 0.3, s * 0.18, s * 0.2, '#e8edf5'); disc(ctx, s * 0.3, s * 0.18, s * 0.2, '#e8edf5'); } },
  { name: 'A hydrogen atom', m: 1.06e-10, draw: (ctx, s) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s / 2); g.addColorStop(0, 'rgba(124,196,255,0.55)'); g.addColorStop(1, 'rgba(124,196,255,0)');
    disc(ctx, 0, 0, s / 2, g); disc(ctx, 0, 0, Math.max(1, s * 0.01), '#f2b45a'); } },
  { name: 'A uranium nucleus', m: 1.5e-14, draw: (ctx, s) => {
    for (let i = 0; i < 70; i++) { const a = i * 2.4, r = Math.sqrt(i / 70) * s * 0.42; disc(ctx, Math.cos(a) * r, Math.sin(a) * r, s * 0.07, i % 5 < 2 ? '#e25a5a' : '#8b96aa'); } } },
  { name: 'A proton', m: 1.68e-15, draw: (ctx, s) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s / 2); g.addColorStop(0, 'rgba(226,90,90,0.5)'); g.addColorStop(1, 'rgba(226,90,90,0.05)');
    disc(ctx, 0, 0, s / 2, g);
    for (const [a, c] of [[0, '#ff5a5a'], [2.1, '#5aff8a'], [4.2, '#5a8aff']]) disc(ctx, Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.2, s * 0.07, c); } },
];

function spiky(colour) {
  return (ctx, s) => {
    ctx.strokeStyle = colour; ctx.lineWidth = Math.max(1, s * 0.03);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.36, Math.sin(a) * s * 0.36); ctx.lineTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5); ctx.stroke(); }
    disc(ctx, 0, 0, s * 0.38, colour);
  };
}

// The object that sits best beside a picture `width` metres across: about a third of the width if possible.
export function pick(width) {
  let best = null, bestD = Infinity;
  for (const o of OBJECTS) {
    const d = Math.abs(Math.log(o.m / (width * 0.33)));
    if (d < bestD) { best = o; bestD = d; }
  }
  return best;
}
