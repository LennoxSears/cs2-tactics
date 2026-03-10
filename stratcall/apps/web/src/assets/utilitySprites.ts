/**
 * SVG sprites for utility effects rendered on the animation canvas.
 * Uses SVG filters (feTurbulence, feDisplacementMap, feGaussianBlur)
 * for organic, non-circular shapes.
 */

const cache = new Map<string, HTMLImageElement>();

function loadSvg(key: string, svg: string): HTMLImageElement {
  if (cache.has(key)) return cache.get(key)!;
  const img = new Image();
  img.src = 'data:image/svg+xml;base64,' + btoa(svg);
  cache.set(key, img);
  return img;
}

// ── Smoke: thick grey cloud ──
// Dense overlapping grey blobs with fractal noise texture for organic edges.
// Looks like an opaque grey cloud blocking vision.
const SMOKE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <filter id="sf" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="5" seed="3" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grey"/>
      <feComponentTransfer in="grey" result="cloud">
        <feFuncR type="linear" slope="0.6" intercept="0.35"/>
        <feFuncG type="linear" slope="0.6" intercept="0.35"/>
        <feFuncB type="linear" slope="0.6" intercept="0.38"/>
        <feFuncA type="table" tableValues="0 0.2 0.6 0.8 0.85 0.8 0.6 0.2 0"/>
      </feComponentTransfer>
      <feGaussianBlur in="cloud" stdDeviation="2.5" result="soft"/>
      <feComposite in="soft" in2="SourceGraphic" operator="in"/>
    </filter>
    <radialGradient id="sg" cx="50%" cy="48%" r="44%">
      <stop offset="0%" stop-color="#c8c8c8" stop-opacity="0.9"/>
      <stop offset="35%" stop-color="#aaaaaa" stop-opacity="0.8"/>
      <stop offset="65%" stop-color="#909090" stop-opacity="0.6"/>
      <stop offset="85%" stop-color="#787878" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#666" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="46" fill="url(#sg)" filter="url(#sf)"/>
  <circle cx="38" cy="42" r="20" fill="#b0b0b0" opacity="0.35"/>
  <circle cx="58" cy="44" r="18" fill="#bcbcbc" opacity="0.3"/>
  <circle cx="46" cy="56" r="19" fill="#a8a8a8" opacity="0.3"/>
  <circle cx="54" cy="38" r="14" fill="#c0c0c0" opacity="0.25"/>
  <circle cx="42" cy="52" r="16" fill="#b5b5b5" opacity="0.25"/>
</svg>`;

// ── Flash: bright starburst with radial spikes ──
// Sharp pointed star shape with bright white center and yellow-white rays.
const FLASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="fg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
      <stop offset="15%" stop-color="#fff" stop-opacity="0.9"/>
      <stop offset="40%" stop-color="#fffde0" stop-opacity="0.5"/>
      <stop offset="70%" stop-color="#fff8b0" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <filter id="ff" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="2"/>
    </filter>
  </defs>
  <circle cx="50" cy="50" r="46" fill="url(#fg)"/>
  <g filter="url(#ff)">
    <polygon points="50,4 53,38 50,32 47,38" fill="#fff" opacity="0.8"/>
    <polygon points="50,96 53,62 50,68 47,62" fill="#fff" opacity="0.8"/>
    <polygon points="4,50 38,47 32,50 38,53" fill="#fff" opacity="0.8"/>
    <polygon points="96,50 62,47 68,50 62,53" fill="#fff" opacity="0.8"/>
    <polygon points="17,17 40,40 36,36 40,36" fill="#fff" opacity="0.6"/>
    <polygon points="83,17 60,40 64,36 60,36" fill="#fff" opacity="0.6"/>
    <polygon points="17,83 40,60 36,64 40,64" fill="#fff" opacity="0.6"/>
    <polygon points="83,83 60,60 64,64 60,64" fill="#fff" opacity="0.6"/>
  </g>
  <circle cx="50" cy="50" r="8" fill="#fff" opacity="0.95"/>
  <circle cx="50" cy="50" r="14" fill="#fff" opacity="0.4"/>
</svg>`;

// ── Molotov / Incendiary: flame cluster with turbulent edges ──
// Multiple flame-shaped paths with warm gradient, distorted by feTurbulence.
const MOLOTOV_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <filter id="mf" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="turbulence" baseFrequency="0.06" numOctaves="3" seed="5" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <radialGradient id="mg" cx="50%" cy="55%" r="45%">
      <stop offset="0%" stop-color="#ffee44" stop-opacity="0.9"/>
      <stop offset="30%" stop-color="#ff8800" stop-opacity="0.7"/>
      <stop offset="60%" stop-color="#dd4400" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#881100" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g filter="url(#mf)">
    <ellipse cx="50" cy="52" rx="30" ry="34" fill="url(#mg)"/>
    <path d="M50,16 C56,30 64,40 62,56 C60,68 40,68 38,56 C36,40 44,30 50,16Z" fill="#ff9922" opacity="0.7"/>
    <path d="M38,28 C42,38 48,44 46,56 C44,64 34,62 34,54 C34,44 36,36 38,28Z" fill="#ff7711" opacity="0.5"/>
    <path d="M62,28 C58,38 52,44 54,56 C56,64 66,62 66,54 C66,44 64,36 62,28Z" fill="#ff7711" opacity="0.5"/>
    <ellipse cx="50" cy="56" rx="12" ry="10" fill="#ffcc44" opacity="0.6"/>
    <ellipse cx="50" cy="52" rx="6" ry="6" fill="#ffee88" opacity="0.5"/>
  </g>
</svg>`;

// ── HE Grenade: yellow-white explosion burst with debris ──
// Bright yellow/white center fading to pale yellow edges.
// Distinct from molotov's orange-red fire look.
const HE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="hg" cx="50%" cy="50%" r="48%">
      <stop offset="0%" stop-color="#ffffee" stop-opacity="0.95"/>
      <stop offset="15%" stop-color="#ffff66" stop-opacity="0.9"/>
      <stop offset="35%" stop-color="#ffee22" stop-opacity="0.7"/>
      <stop offset="55%" stop-color="#eecc00" stop-opacity="0.4"/>
      <stop offset="75%" stop-color="#ccaa00" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#998800" stop-opacity="0"/>
    </radialGradient>
    <filter id="hf" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" seed="8" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
  <g filter="url(#hf)">
    <polygon points="50,6 56,30 78,14 64,36 96,38 68,48 90,70 60,58 66,88 50,64 34,88 40,58 10,70 32,48 4,38 36,36 22,14 44,30" fill="url(#hg)"/>
    <circle cx="50" cy="50" r="14" fill="#ffff88" opacity="0.8"/>
    <circle cx="50" cy="50" r="7" fill="#fff" opacity="0.7"/>
  </g>
  <g fill="#ffdd44" opacity="0.5">
    <circle cx="26" cy="22" r="2"/>
    <circle cx="78" cy="26" r="1.5"/>
    <circle cx="18" cy="62" r="1.8"/>
    <circle cx="82" cy="68" r="2"/>
    <circle cx="34" cy="82" r="1.5"/>
    <circle cx="70" cy="86" r="1.8"/>
    <circle cx="14" cy="44" r="1.2"/>
    <circle cx="88" cy="48" r="1.4"/>
  </g>
</svg>`;

export function getSmokeSprite(): HTMLImageElement { return loadSvg('smoke', SMOKE_SVG); }
export function getFlashSprite(): HTMLImageElement { return loadSvg('flash', FLASH_SVG); }
export function getMolotovSprite(): HTMLImageElement { return loadSvg('molotov', MOLOTOV_SVG); }
export function getHeSprite(): HTMLImageElement { return loadSvg('he', HE_SVG); }

export function getUtilitySprite(type: string): HTMLImageElement | null {
  switch (type) {
    case 'smoke': return getSmokeSprite();
    case 'flash': return getFlashSprite();
    case 'molotov': return getMolotovSprite();
    case 'he': return getHeSprite();
    default: return null;
  }
}

// Pre-load all sprites on module import
getSmokeSprite();
getFlashSprite();
getMolotovSprite();
getHeSprite();

/** Canvas-drawn sprite cache — no SVG filter dependency.
 *  Each sprite is drawn procedurally using canvas gradients
 *  and compositing, guaranteed to work in all webviews. */
const rasterCache = new Map<string, HTMLCanvasElement>();

function buildSmokeCanvas(sz: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d')!;
  const cx = sz / 2, cy = sz / 2, r = sz * 0.44;

  // Base radial gradient
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, 'rgba(190,190,195,0.85)');
  g.addColorStop(0.35, 'rgba(170,170,175,0.7)');
  g.addColorStop(0.65, 'rgba(145,145,150,0.45)');
  g.addColorStop(0.85, 'rgba(120,120,125,0.15)');
  g.addColorStop(1, 'rgba(100,100,105,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sz, sz);

  // Overlapping blobs for organic shape
  const blobs = [
    [0.38, 0.42, 0.20], [0.58, 0.44, 0.18], [0.46, 0.56, 0.19],
    [0.54, 0.38, 0.14], [0.42, 0.52, 0.16], [0.50, 0.50, 0.22],
  ];
  for (const [bx, by, br] of blobs) {
    const bg = ctx.createRadialGradient(bx * sz, by * sz, 0, bx * sz, by * sz, br * sz);
    bg.addColorStop(0, 'rgba(180,180,185,0.3)');
    bg.addColorStop(1, 'rgba(160,160,165,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx * sz, by * sz, br * sz, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function buildFlashCanvas(sz: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d')!;
  const cx = sz / 2, cy = sz / 2;

  // Bright radial glow
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 0.45);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.2, 'rgba(255,255,230,0.8)');
  g.addColorStop(0.5, 'rgba(255,255,180,0.4)');
  g.addColorStop(1, 'rgba(255,255,150,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sz, sz);

  // Star rays
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(-1.5, 0);
    ctx.lineTo(0, -sz * 0.42);
    ctx.lineTo(1.5, 0);
    ctx.fillStyle = 'rgba(255,255,220,0.6)';
    ctx.fill();
  }
  ctx.restore();
  return c;
}

function buildMolotovCanvas(sz: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d')!;
  const cx = sz / 2, cy = sz / 2;

  // Fire gradient
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 0.44);
  g.addColorStop(0, 'rgba(255,200,50,0.8)');
  g.addColorStop(0.3, 'rgba(255,120,20,0.6)');
  g.addColorStop(0.6, 'rgba(220,60,10,0.35)');
  g.addColorStop(1, 'rgba(180,30,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sz, sz);

  // Flame blobs
  const blobs = [
    [0.35, 0.40, 0.16], [0.60, 0.42, 0.14], [0.48, 0.55, 0.17],
    [0.55, 0.35, 0.12], [0.40, 0.50, 0.15],
  ];
  for (const [bx, by, br] of blobs) {
    const bg = ctx.createRadialGradient(bx * sz, by * sz, 0, bx * sz, by * sz, br * sz);
    bg.addColorStop(0, 'rgba(255,160,30,0.4)');
    bg.addColorStop(1, 'rgba(255,80,10,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx * sz, by * sz, br * sz, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function buildHeCanvas(sz: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d')!;
  const cx = sz / 2, cy = sz / 2;

  // Explosion flash
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 0.44);
  g.addColorStop(0, 'rgba(255,255,200,0.9)');
  g.addColorStop(0.25, 'rgba(255,220,80,0.6)');
  g.addColorStop(0.5, 'rgba(255,160,40,0.3)');
  g.addColorStop(1, 'rgba(200,100,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sz, sz);
  return c;
}

export function getRasterizedSprite(type: string): HTMLCanvasElement | null {
  return rasterCache.get(type) || null;
}

export async function preloadSprites(): Promise<void> {
  const sz = 128;
  if (!rasterCache.has('smoke')) rasterCache.set('smoke', buildSmokeCanvas(sz));
  if (!rasterCache.has('flash')) rasterCache.set('flash', buildFlashCanvas(sz));
  if (!rasterCache.has('molotov')) rasterCache.set('molotov', buildMolotovCanvas(sz));
  if (!rasterCache.has('he')) rasterCache.set('he', buildHeCanvas(sz));
}
