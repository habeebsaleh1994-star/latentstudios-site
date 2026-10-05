/* Makes the sample project images for Atelier: type, grids, colour and compositions built by rule, rendered with a headless browser.
   Run: node make-images.mjs   (needs Playwright and network for the fonts). Output: ../media/*.jpg */
import { chromium } from 'playwright-core'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), out = process.env.OUT || path.join(here, '../media');
const exe = fs.readdirSync(process.env.HOME+'/Library/Caches/ms-playwright').find(d=>d.startsWith('chromium_headless_shell'));
const C = { paper:'#EFE7DA', almond:'#C9A27E', salt:'#D9D4CC', ink:'#2A2220', clay:'#B5684B', sage:'#8FA08F', mist:'#DDE3DC', deep:'#2B3A4A', pale:'#E9EEF2', rose:'#C48A97', silk:'#EEE9E7' };
const W=1600, H=1200;
const css = `@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;1,6..72,300;1,6..72,400&family=Instrument+Sans:wght@400;500&family=Instrument+Serif:ital@0;1&family=Libre+Caslon+Text:ital@0;1&family=IBM+Plex+Mono:wght@400&display=swap');
body{margin:0} svg{display:block} .nw{font-family:'Newsreader',serif} .is{font-family:'Instrument Sans',sans-serif} .ise{font-family:'Instrument Serif',serif} .lc{font-family:'Libre Caslon Text',serif} .mono{font-family:'IBM Plex Mono',monospace}`;
const svg = (bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;
const L = (x,y,w,c,o=1)=>`<rect x="${x}" y="${y}" width="${w}" height="3" fill="${c}" opacity="${o}"/>`;
const lines = (x,y,n,w,gap,c,o=.5)=>Array.from({length:n},(_,i)=>L(x,y+i*gap,i===n-1?w*.6:w,c,o)).join('');
const img = {};

/* ---------- Almond & Salt: a bakery identity ---------- */
img['almond-wordmark'] = svg(C.paper, `
 <rect x="70" y="70" width="${W-140}" height="${H-140}" fill="none" stroke="${C.ink}" stroke-width="2" opacity=".5"/>
 <circle cx="${W/2}" cy="260" r="58" fill="${C.clay}"/><circle cx="${W/2+22}" cy="260" r="58" fill="${C.paper}"/>
 <text x="${W/2}" y="640" text-anchor="middle" class="nw" font-size="250" font-style="italic" font-weight="300" fill="${C.ink}">Almond</text>
 <text x="${W/2}" y="840" text-anchor="middle" class="nw" font-size="210" font-weight="300" fill="${C.clay}">&amp; Salt</text>
 <text x="${W/2}" y="1010" text-anchor="middle" class="is" font-size="30" letter-spacing="9" fill="${C.ink}" opacity=".7">BREAD, QUIETLY · SINCE 2019</text>`);
img['almond-bag'] = svg(C.salt, `
 <rect x="360" y="140" width="880" height="940" fill="${C.almond}"/><path d="M360 140 L1240 140 L1240 230 L360 230 Z" fill="#B88F69"/>
 <path d="M360 230 q220 40 440 0 t440 0" fill="none" stroke="#A9805C" stroke-width="4"/>
 <rect x="480" y="420" width="640" height="460" fill="${C.paper}"/>
 <text x="800" y="620" text-anchor="middle" class="nw" font-size="110" font-style="italic" font-weight="300" fill="${C.ink}">Almond</text>
 <text x="800" y="730" text-anchor="middle" class="nw" font-size="90" font-weight="300" fill="${C.clay}">&amp; Salt</text>
 <text x="800" y="820" text-anchor="middle" class="is" font-size="22" letter-spacing="6" fill="${C.ink}" opacity=".7">SEEDED RYE · 800 G</text>
 <circle cx="800" cy="340" r="26" fill="${C.clay}"/><circle cx="811" cy="340" r="26" fill="${C.almond}"/>`);
img['almond-brief'] = svg(C.paper, `
 <text x="120" y="180" class="is" font-size="26" letter-spacing="8" fill="${C.ink}" opacity=".6">BRIEF · THE ROOM WE ARE DESIGNING FOR</text>
 ${[C.paper,C.almond,C.salt,C.clay,C.ink].map((c,i)=>`<circle cx="${250+i*300}" cy="520" r="120" fill="${c}" stroke="${C.ink}" stroke-opacity=".25" stroke-width="2"/>`).join('')}
 ${['almond','salt','clay','ink','paper'].map((n,i)=>`<text x="${250+i*300}" y="720" text-anchor="middle" class="mono" font-size="26" fill="${C.ink}" opacity=".6">${n}</text>`).join('')}
 <text x="120" y="930" class="nw" font-size="92" font-style="italic" font-weight="300" fill="${C.ink}">warm, plain, unhurried.</text>`);
img['almond-construction'] = svg(C.paper, `
 <g stroke="${C.clay}" stroke-width="2" fill="none" opacity=".85">
  <line x1="80" y1="640" x2="${W-80}" y2="640"/><line x1="80" y1="470" x2="${W-80}" y2="470"/><line x1="80" y1="400" x2="${W-80}" y2="400" stroke-dasharray="10 10"/><line x1="80" y1="760" x2="${W-80}" y2="760" stroke-dasharray="10 10"/>
  <circle cx="800" cy="520" r="360"/><circle cx="800" cy="520" r="180"/><line x1="800" y1="100" x2="800" y2="1100"/>
 </g>
 <text x="${W/2}" y="640" text-anchor="middle" class="nw" font-size="250" font-style="italic" font-weight="300" fill="${C.ink}" opacity=".9">Almond</text>
 <text x="${W/2}" y="840" text-anchor="middle" class="nw" font-size="210" font-weight="300" fill="${C.ink}" opacity=".9">&amp; Salt</text>
 <text x="120" y="140" class="is" font-size="26" letter-spacing="8" fill="${C.clay}">CONSTRUCTION · ONE CIRCLE, ONE BASELINE</text>`);
img['almond-types'] = svg(C.paper, `
 <text x="120" y="140" class="is" font-size="26" letter-spacing="8" fill="${C.ink}" opacity=".6">TYPE TESTS · THREE FACES, ONE WORD</text>
 ${[['A','nw','Newsreader'],['B','ise','Instrument Serif'],['C','lc','Libre Caslon']].map((r,i)=>`
  <line x1="120" y1="${300+i*300}" x2="${W-120}" y2="${300+i*300}" stroke="${C.ink}" stroke-opacity=".25" stroke-width="2"/>
  <text x="120" y="${450+i*300}" class="is" font-size="34" fill="${C.ink}" opacity=".6">${r[0]}</text>
  <text x="260" y="${480+i*300}" class="${r[1]}" font-size="140" font-style="italic" fill="${C.ink}">Almond &amp; Salt</text>
  <text x="${W-120}" y="${545+i*300}" text-anchor="end" class="is" font-size="22" letter-spacing="4" fill="${C.ink}" opacity=".5">${r[2].toUpperCase()}</text>`).join('')}
 <circle cx="95" cy="${300+0*300+95}" r="58" fill="none" stroke="${C.clay}" stroke-width="4"/>`);

/* ---------- Field Notes: a book ---------- */
img['notes-cover'] = svg(C.sage, `
 <rect x="360" y="110" width="880" height="980" fill="${C.mist}"/>
 ${Array.from({length:5},(_,r)=>Array.from({length:7},(_,c)=>`<rect x="${430+c*108}" y="${180+r*40}" width="76" height="22" fill="${(r+c)%3===0?C.sage:C.salt}"/>`).join('')).join('')}
 <text x="430" y="650" class="nw" font-size="132" font-weight="300" fill="${C.ink}">Field</text>
 <text x="430" y="780" class="nw" font-size="132" font-style="italic" font-weight="300" fill="${C.ink}">Notes</text>
 <text x="430" y="880" class="is" font-size="26" letter-spacing="7" fill="${C.ink}" opacity=".7">A YEAR OF WALKS, 2024</text>
 <text x="430" y="1020" class="is" font-size="22" letter-spacing="6" fill="${C.ink}" opacity=".6">ARCHIVE PRESS</text>`);
img['notes-spread'] = svg(C.salt, `
 <rect x="150" y="190" width="620" height="820" fill="${C.paper}"/><rect x="830" y="190" width="620" height="820" fill="${C.paper}"/>
 <text x="210" y="420" class="nw" font-size="260" font-weight="300" fill="${C.sage}">14</text>
 ${lines(210,520,9,500,34,C.ink,.45)}
 ${lines(890,260,9,500,34,C.ink,.45)}${lines(890,620,8,500,34,C.ink,.45)}
 <rect x="890" y="920" width="150" height="3" fill="${C.clay}"/>`);
img['notes-grid'] = svg(C.paper, `
 <text x="120" y="140" class="is" font-size="26" letter-spacing="8" fill="${C.ink}" opacity=".6">GRID · TWELVE COLUMNS, ONE MARGIN</text>
 ${Array.from({length:12},(_,i)=>`<rect x="${120+i*(W-240)/12}" y="220" width="${(W-240)/12-18}" height="860" fill="${C.rose}" opacity=".28"/>`).join('')}
 <rect x="${120+(W-240)/12*2}" y="380" width="${(W-240)/12*5-18}" height="460" fill="${C.sage}" opacity=".8"/>
 ${lines(120+(W-240)/12*8,380,10,(W-240)/12*3-18,36,C.ink,.5)}`);
img['notes-thumbs'] = svg(C.paper, `
 <text x="120" y="140" class="is" font-size="26" letter-spacing="8" fill="${C.ink}" opacity=".6">THUMBNAILS · EIGHT WAYS TO TURN A PAGE</text>
 ${Array.from({length:8},(_,i)=>{const x=120+(i%4)*370, y=240+Math.floor(i/4)*450; const k=i; return `<rect x="${x}" y="${y}" width="320" height="400" fill="${C.salt}" stroke="${C.ink}" stroke-opacity=".3" stroke-width="2"/>`+(k%4===0?`<rect x="${x+30}" y="${y+30}" width="260" height="190" fill="${C.sage}"/>${lines(x+30,y+260,5,260,26,C.ink,.5)}`:k%4===1?`<rect x="${x+30}" y="${y+30}" width="120" height="340" fill="${C.sage}"/>${lines(x+175,y+40,9,115,34,C.ink,.5)}`:k%4===2?`${lines(x+30,y+40,12,260,28,C.ink,.5)}`:`<circle cx="${x+160}" cy="${y+170}" r="110" fill="${C.sage}"/>${lines(x+30,y+320,3,260,26,C.ink,.5)}`);}).join('')}`);
img['notes-colour'] = svg(C.paper, `
 <text x="120" y="140" class="is" font-size="26" letter-spacing="8" fill="${C.ink}" opacity=".6">COLOUR · FIVE GREYED GREENS AND A WARM PAPER</text>
 ${[C.mist,C.sage,'#6F826F','#566656',C.ink,C.paper].map((c,i)=>`<rect x="${120+i*230}" y="260" width="200" height="640" fill="${c}" stroke="${C.ink}" stroke-opacity=".2" stroke-width="2"/>`).join('')}
 <text x="120" y="1020" class="nw" font-size="70" font-style="italic" font-weight="300" fill="${C.ink}">quiet, but not grey.</text>`);

/* ---------- Low Tide: an exhibition poster ---------- */
img['tide-poster'] = svg(C.deep, `
 <circle cx="800" cy="720" r="470" fill="${C.pale}"/><rect x="0" y="720" width="${W}" height="${H-720}" fill="${C.deep}"/>
 <path d="M0 720 H${W}" stroke="${C.pale}" stroke-width="3" opacity=".6"/>
 <text x="110" y="250" class="nw" font-size="200" font-weight="300" fill="${C.pale}">Low</text>
 <text x="110" y="440" class="nw" font-size="200" font-style="italic" font-weight="300" fill="${C.rose}">Tide</text>
 <text x="110" y="1090" class="is" font-size="28" letter-spacing="8" fill="${C.pale}" opacity=".8">AN EXHIBITION OF THE SHORE · 3 – 28 NOVEMBER</text>`);
img['tide-thumbs'] = svg(C.paper, `
 <text x="120" y="140" class="is" font-size="26" letter-spacing="8" fill="${C.ink}" opacity=".6">COMPOSITION STUDIES · WHERE DOES THE HORIZON SIT</text>
 ${[0.25,0.4,0.5,0.62,0.74,0.86].map((h,i)=>{const x=120+(i%3)*480,y=240+Math.floor(i/3)*470,w=420,hh=420; return `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${C.salt}" stroke="${C.ink}" stroke-opacity=".3" stroke-width="2"/><circle cx="${x+w/2}" cy="${y+hh*h}" r="${hh*.28}" fill="none" stroke="${C.ink}" stroke-width="3"/><line x1="${x}" y1="${y+hh*h}" x2="${x+w}" y2="${y+hh*h}" stroke="${C.clay}" stroke-width="3"/>`;}).join('')}`);
img['tide-sketch'] = svg(C.paper, `
 <g fill="none" stroke="${C.ink}" stroke-width="3" opacity=".8"><circle cx="800" cy="720" r="470"/><line x1="0" y1="720" x2="${W}" y2="720"/></g>
 <text x="110" y="250" class="nw" font-size="200" font-weight="300" fill="none" stroke="${C.ink}" stroke-width="2" opacity=".6">Low</text>
 <text x="110" y="440" class="nw" font-size="200" font-style="italic" font-weight="300" fill="none" stroke="${C.ink}" stroke-width="2" opacity=".6">Tide</text>
 <text x="110" y="1090" class="is" font-size="28" letter-spacing="8" fill="${C.ink}" opacity=".5">first sketch · circle and a line</text>`);

const b = await chromium.launch({executablePath:`${process.env.HOME}/Library/Caches/ms-playwright/${exe}/chrome-headless-shell-mac-arm64/chrome-headless-shell`});
const p = await b.newPage({viewport:{width:W,height:H}});
for (const [name, s] of Object.entries(img)) {
  await p.setContent(`<style>${css}</style>${s}`); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(500);
  await p.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:86});
}
await b.close(); console.log('made', Object.keys(img).length, 'images');
