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

// ── Smoke: fractal noise cloud with irregular edges ──
// feTurbulence fractalNoise creates organic cloud texture,
// composited with a soft radial gradient mask for natural falloff.
const SMOKE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <filter id="sf" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="2" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grey"/>
      <feComponentTransfer in="grey" result="cloud">
        <feFuncA type="table" tableValues="0 0 0.3 0.5 0.6 0.5 0.3 0"/>
      </feComponentTransfer>
      <feGaussianBlur in="cloud" stdDeviation="3" result="soft"/>
      <feComposite in="soft" in2="SourceGraphic" operator="in"/>
    </filter>
    <radialGradient id="sg" cx="50%" cy="50%" r="45%">
      <stop offset="0%" stop-color="#d0d0d0" stop-opacity="0.7"/>
      <stop offset="40%" stop-color="#b0b0b0" stop-opacity="0.5"/>
      <stop offset="75%" stop-color="#909090" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#808080" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="44" fill="url(#sg)" filter="url(#sf)"/>
  <circle cx="42" cy="44" r="22" fill="#bbb" opacity="0.18"/>
  <circle cx="56" cy="48" r="20" fill="#ccc" opacity="0.15"/>
  <circle cx="50" cy="56" r="18" fill="#aaa" opacity="0.12"/>
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

// ── HE Grenade: explosion with jagged burst and debris ──
// Irregular star polygon with warm center, distorted by turbulence,
// plus scattered debris particles.
const HE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="hg" cx="50%" cy="50%" r="48%">
      <stop offset="0%" stop-color="#ffee44" stop-opacity="0.95"/>
      <stop offset="20%" stop-color="#ffaa00" stop-opacity="0.8"/>
      <stop offset="45%" stop-color="#dd5500" stop-opacity="0.5"/>
      <stop offset="70%" stop-color="#882200" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#441100" stop-opacity="0"/>
    </radialGradient>
    <filter id="hf" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" seed="8" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
  <g filter="url(#hf)">
    <polygon points="50,6 56,30 78,14 64,36 96,38 68,48 90,70 60,58 66,88 50,64 34,88 40,58 10,70 32,48 4,38 36,36 22,14 44,30" fill="url(#hg)"/>
    <circle cx="50" cy="50" r="14" fill="#ffcc22" opacity="0.7"/>
    <circle cx="50" cy="50" r="7" fill="#fff" opacity="0.5"/>
  </g>
  <g fill="#ff8800" opacity="0.6">
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
