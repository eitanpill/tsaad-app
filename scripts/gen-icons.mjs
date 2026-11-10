// Renders the PWA icons (public/icons/*.png and public/apple-touch-icon.png) from the brand cup glyph
// (terracotta tile, white glass, the same mark as the install screen). Uses the locally installed Chromium.
// Run: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/gen-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const TERRACOTTA = "#BB6F51";

/** glyphScale: share of the canvas the glass occupies (maskable icons keep it inside the 80% safe zone). */
const svg = (size, glyphScale) => {
  const h = size * glyphScale;
  const w = (h * 40) / 48;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="${TERRACOTTA}"/>
<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 40 48">
<path d="M5 4 L35 4 L31 44 L9 44 Z" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M8 26 Q14 22 20 26 T32 26 L31 44 L9 44 Z" fill="#FFFFFF"/>
</svg></svg>`;
};

const targets = [
  { file: "public/icons/icon-192.png", size: 192, scale: 0.6 },
  { file: "public/icons/icon-512.png", size: 512, scale: 0.6 },
  { file: "public/icons/maskable-512.png", size: 512, scale: 0.46 },
  { file: "public/apple-touch-icon.png", size: 180, scale: 0.6 },
];

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
try {
  for (const t of targets) {
    const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
    await page.setContent(`<body style="margin:0">${svg(t.size, t.scale)}</body>`);
    writeFileSync(t.file, await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: t.size, height: t.size } }));
    await page.close();
    console.log("wrote", t.file);
  }
} finally {
  await browser.close();
}
