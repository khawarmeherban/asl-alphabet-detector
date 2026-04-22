import { LETTER_REFERENCE_HINTS } from './constants';

function createReferenceSvg(letter) {
  const upper = String(letter || 'A').toUpperCase();
  const hint = LETTER_REFERENCE_HINTS[upper] || 'ASL reference card';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#03120c" />
          <stop offset="100%" stop-color="#0b2f1f" />
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#00ff88" />
          <stop offset="100%" stop-color="#69ffbe" />
        </linearGradient>
      </defs>
      <rect width="480" height="360" rx="28" fill="url(#bg)" />
      <rect x="20" y="20" width="440" height="320" rx="24" fill="none" stroke="url(#accent)" stroke-width="2" />
      <circle cx="130" cy="180" r="88" fill="rgba(0,255,136,0.08)" stroke="#00ff88" stroke-width="3" />
      <path d="M100 224 C96 180, 96 126, 116 108 C130 95, 148 104, 150 128 L154 224" fill="none" stroke="#d7ffe9" stroke-width="16" stroke-linecap="round" />
      <path d="M150 224 L150 116" fill="none" stroke="#d7ffe9" stroke-width="16" stroke-linecap="round" />
      <path d="M174 224 L174 128" fill="none" stroke="#d7ffe9" stroke-width="16" stroke-linecap="round" />
      <path d="M198 224 L198 144" fill="none" stroke="#d7ffe9" stroke-width="16" stroke-linecap="round" />
      <path d="M112 178 L84 152" fill="none" stroke="#d7ffe9" stroke-width="14" stroke-linecap="round" />
      <text x="265" y="122" fill="#00ff88" font-size="24" font-family="Segoe UI, Arial, sans-serif" letter-spacing="4">ASL REFERENCE</text>
      <text x="260" y="215" fill="#ffffff" font-size="124" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${upper}</text>
      <text x="260" y="256" fill="#b2f5d0" font-size="22" font-family="Segoe UI, Arial, sans-serif">${hint}</text>
      <text x="260" y="292" fill="#7be5b1" font-size="17" font-family="Segoe UI, Arial, sans-serif">Swap this generated card with custom sign stills anytime.</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function getReferenceCard(letter) {
  const upper = String(letter || 'A').toUpperCase();
  return {
    letter: upper,
    title: `ASL ${upper}`,
    image: createReferenceSvg(upper)
  };
}

export default getReferenceCard;
