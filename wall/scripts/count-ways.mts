/* The arrival page's count of designed ways: every template's looks × faces (the look's own counted) × its dials × day and night;
   before accent, palette, spacing and mount. Run: npx tsx scripts/count-ways.mts   and put the number on design/home/index.html. */
import { HOUSES } from "../src/app/houses";
const dials = (h: (typeof HOUSES)[number]) => (Object.values(h.dials) as string[][]).reduce((m, d) => m * d.length, 1);
const n = HOUSES.reduce((t, h) => t + h.looks.length * (h.typefaces.length + 1) * dials(h) * 2, 0);
console.log(`${HOUSES.length} templates: ${n.toLocaleString("en-GB")} designed ways`);
