// Daystone: úvodná scéna „lesklé kamienky na slnečnom parapete“ (KONCEPT 9.3), celá z kódu.
// Okno s ranným marhuľovým nebom, slnko vpravo hore (tiene padajú doľava), parapet,
// sklenený pohár s kamienkami v pastelových farbách a dva kamienky s tvárou: vy dvaja.
import { svgKamienok } from './kamienok.mjs';

// [rodina, hĺbka, x, y, veľkosť] kamienkov v pohári, odspodu
const V_POHARI = [
  ['calm', 2, 134, 296, 34], ['tense', 2, 162, 300, 32], ['bright', 2, 190, 294, 36],
  ['low', 2, 140, 268, 30], ['okay', 3, 166, 270, 32], ['bright', 3, 196, 266, 30],
  ['tense', 3, 134, 242, 30], ['calm', 3, 160, 244, 30], ['low', 3, 188, 240, 34],
  ['okay', 2, 146, 216, 30], ['bright', 1, 174, 216, 30], ['calm', 1, 198, 212, 28],
];

export function scena() {
  const kamene = V_POHARI.map(([r, h, x, y, s]) => svgKamienok(r, h, { tvar: false, x, y, s })).join('');
  return `<svg class="scena" viewBox="0 0 640 420" aria-hidden="true" focusable="false">
<defs>
  <linearGradient id="sc-nebo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD3B0"/><stop offset=".55" stop-color="#FFE9D4"/><stop offset="1" stop-color="#E3ECFF"/></linearGradient>
  <radialGradient id="sc-slnko"><stop offset="0" stop-color="#FFF8E1"/><stop offset=".55" stop-color="#FFE3A3"/><stop offset="1" stop-color="#FFD27A"/></radialGradient>
  <radialGradient id="sc-ziara"><stop offset="0" stop-color="#FFE7B8" stop-opacity=".8"/><stop offset="1" stop-color="#FFE7B8" stop-opacity="0"/></radialGradient>
  <linearGradient id="sc-hrana" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0E2D2"/><stop offset="1" stop-color="#E4D3C1"/></linearGradient>
  <linearGradient id="sc-sklo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity=".4"/></linearGradient>
  <clipPath id="sc-okno"><rect x="150" y="18" width="380" height="296" rx="30"/></clipPath>
</defs>
<rect x="150" y="18" width="380" height="296" rx="30" fill="url(#sc-nebo)"/>
<g clip-path="url(#sc-okno)">
  <circle cx="452" cy="92" r="130" fill="url(#sc-ziara)"/>
  <circle class="sc-slnko" cx="452" cy="92" r="34" fill="url(#sc-slnko)"/>
  <path d="M150 262C210 238 262 246 318 258C372 270 430 250 530 236L530 314L150 314Z" fill="#F6DCCB" opacity=".75"/>
</g>
<rect x="150" y="18" width="380" height="296" rx="30" fill="none" stroke="#FFFDF9" stroke-width="12"/>
<path d="M340 22V310M154 168H526" stroke="#FFFDF9" stroke-width="9"/>
<path d="M44 312H596L616 336H24Z" fill="#F8EEE2"/>
<path d="M44 312H596" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
<rect x="24" y="336" width="592" height="40" rx="6" fill="url(#sc-hrana)"/>
<g fill="#2A2238" opacity=".07">
  <ellipse cx="150" cy="330" rx="88" ry="7"/>
  <ellipse cx="370" cy="330" rx="60" ry="6"/>
  <ellipse cx="462" cy="330" rx="64" ry="6"/>
  <ellipse cx="546" cy="330" rx="34" ry="5"/>
</g>
<g class="sc-pohar">
  <rect x="132" y="168" width="96" height="18" rx="7" fill="#F4E3CE" stroke="#2A2238" stroke-opacity=".16" stroke-width="2"/>
  ${kamene}
  <path d="M128 200Q126 186 140 186H220Q234 186 232 200L234 312Q234 330 214 330H148Q128 330 128 312Z" fill="url(#sc-sklo)" stroke="#2A2238" stroke-opacity=".18" stroke-width="2"/>
  <path d="M142 204V300" stroke="#fff" stroke-opacity=".8" stroke-width="6" stroke-linecap="round"/>
  <path d="M220 214V246" stroke="#fff" stroke-opacity=".55" stroke-width="4" stroke-linecap="round"/>
</g>
<g class="sc-maly">${svgKamienok('okay', 2, { tvar: false, x: 256, y: 302, s: 28 })}${svgKamienok('bright', 2, { tvar: false, x: 282, y: 306, s: 24 })}</g>
<g class="sc-vy sc-vy-1">${svgKamienok('calm', 3, { x: 318, y: 228, s: 104 })}</g>
<g class="sc-vy sc-vy-2">${svgKamienok('tense', 2, { x: 412, y: 238, s: 94 })}</g>
<g class="sc-rastlina">
  <path d="M548 260C540 236 528 226 516 222C528 238 534 250 546 262ZM552 258C556 232 566 218 580 212C574 230 566 246 556 260Z" fill="#9AD8BC"/>
  <path d="M550 262V280" stroke="#6FBF9C" stroke-width="3" stroke-linecap="round"/>
  <path d="M526 280H576L570 326Q569 330 564 330H538Q533 330 532 326Z" fill="#FFC9B5"/>
  <path d="M526 280H576" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>
</g>
</svg>`;
}
