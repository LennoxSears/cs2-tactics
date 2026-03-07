/**
 * SVG sprites for utility effects rendered on the animation canvas.
 * Each sprite is a pre-loaded Image from an inline data URI.
 */

const cache = new Map<string, HTMLImageElement>();

function loadSvg(key: string, svg: string): HTMLImageElement {
  if (cache.has(key)) return cache.get(key)!;
  const img = new Image();
  img.src = 'data:image/svg+xml;base64,' + btoa(svg);
  cache.set(key, img);
  return img;
}

// ── Smoke: layered translucent cloud puffs ──
const SMOKE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <defs>
    <radialGradient id="sg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#c8c8c8" stop-opacity="0.6"/>
      <stop offset="60%" stop-color="#999" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#777" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="40" cy="40" r="38" fill="url(#sg)"/>
  <circle cx="30" cy="32" r="20" fill="#aaa" opacity="0.25"/>
  <circle cx="50" cy="35" r="18" fill="#bbb" opacity="0.2"/>
  <circle cx="38" cy="50" r="16" fill="#aaa" opacity="0.2"/>
  <circle cx="48" cy="28" r="14" fill="#ccc" opacity="0.18"/>
  <circle cx="32" cy="46" r="12" fill="#bbb" opacity="0.15"/>
</svg>`;

// ── Flash: bright starburst ──
const FLASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <defs>
    <radialGradient id="fg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.95"/>
      <stop offset="30%" stop-color="#fffde0" stop-opacity="0.7"/>
      <stop offset="70%" stop-color="#fff8b0" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="40" cy="40" r="38" fill="url(#fg)"/>
  <g stroke="#fff" stroke-opacity="0.6" stroke-width="1.5" stroke-linecap="round">
    <line x1="40" y1="6" x2="40" y2="18"/>
    <line x1="40" y1="62" x2="40" y2="74"/>
    <line x1="6" y1="40" x2="18" y2="40"/>
    <line x1="62" y1="40" x2="74" y2="40"/>
    <line x1="16" y1="16" x2="24" y2="24"/>
    <line x1="56" y1="56" x2="64" y2="64"/>
    <line x1="64" y1="16" x2="56" y2="24"/>
    <line x1="16" y1="64" x2="24" y2="56"/>
  </g>
  <circle cx="40" cy="40" r="10" fill="#fff" opacity="0.8"/>
</svg>`;

// ── Molotov / Incendiary: flame cluster ──
const MOLOTOV_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <defs>
    <radialGradient id="mg" cx="50%" cy="60%" r="50%">
      <stop offset="0%" stop-color="#ffcc33" stop-opacity="0.8"/>
      <stop offset="40%" stop-color="#ff6600" stop-opacity="0.5"/>
      <stop offset="80%" stop-color="#cc2200" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#880000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="40" cy="42" r="36" fill="url(#mg)"/>
  <g fill-opacity="0.7">
    <ellipse cx="40" cy="48" rx="10" ry="16" fill="#ff8800"/>
    <ellipse cx="30" cy="50" rx="8" ry="14" fill="#ff6600" transform="rotate(-12 30 50)"/>
    <ellipse cx="50" cy="50" rx="8" ry="14" fill="#ff6600" transform="rotate(12 50 50)"/>
    <ellipse cx="36" cy="44" rx="6" ry="10" fill="#ffaa22"/>
    <ellipse cx="46" cy="46" rx="5" ry="9" fill="#ffaa22"/>
  </g>
  <ellipse cx="40" cy="52" rx="6" ry="8" fill="#ffdd66" opacity="0.6"/>
</svg>`;

// ── HE Grenade: explosion burst ──
const HE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <defs>
    <radialGradient id="hg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffee44" stop-opacity="0.9"/>
      <stop offset="25%" stop-color="#ff8800" stop-opacity="0.6"/>
      <stop offset="55%" stop-color="#cc4400" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#662200" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="40" cy="40" r="38" fill="url(#hg)"/>
  <g fill-opacity="0.5">
    <polygon points="40,8 44,28 60,14 48,32 72,30 52,40 72,50 48,48 60,66 44,52 40,72 36,52 20,66 32,48 8,50 28,40 8,30 32,32 20,14 36,28" fill="#ff9900"/>
  </g>
  <circle cx="40" cy="40" r="10" fill="#ffdd44" opacity="0.7"/>
  <circle cx="40" cy="40" r="5" fill="#fff" opacity="0.5"/>
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
