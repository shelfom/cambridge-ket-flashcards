import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const data = JSON.parse(await readFile(join(ROOT, "src/data/ket-a.json"), "utf8"));
const iconDir = join(ROOT, "node_modules/openmoji/color/svg");
const outputDir = join(ROOT, "public/images/a");

const scenes = [
  ["single", "1F34E"], ["trio", "1F34E", "1F34F", "1F34E"], ["duo", "1F4AA", "1F9D2"], ["duo", "1F4AC", "1F914"],
  ["above", "1F388", "1F3E0"], ["duo", "1F697", "1F4A5"], ["duo", "1F3E0", "1F6CF"], ["journey", "1F6B6", "1F309"],
  ["duo", "1F3AD", "1F9D2"], ["single", "1F3C3"], ["duo", "1F3A8", "1F9D2"], ["duo", "1F9D1", "1F3AD"],
  ["duo", "1F50D", "2705"], ["duo", "1F4E2", "1F6B2"], ["add", "1F34E", "1F34F", "1F34E"], ["duo", "1F3E0", "2709"],
  ["scale", "1F9D1", "1F9D2"], ["duo", "1F916", "1F680"], ["duo", "1F9D7", "26F0"], ["duo", "1F4E2", "1F6B2"],
  ["duo", "1F4FA", "1F6B2"], ["duo", "1F4AC", "1F4A1"], ["single", "2708"], ["duo", "1F628", "1F577"],
  ["journey", "1F327", "1F308"], ["duo", "2600", "1F4D6"], ["journey", "1F37D", "1F9FC"], ["duo", "1F501", "1F3C0"],
  ["duo", "26BD", "2694"], ["trio", "1F476", "1F9D1", "1F9D3"], ["duo", "1F9D2", "1F382"], ["duo", "23EA", "23F3"],
  ["duo", "1F91D", "2705"], ["duo", "1F32C", "1F343"], ["duo", "1F6EB", "1F9F3"], ["single", "23F0"],
  ["duo", "1F5BC", "1F4F7"], ["single", "1F465"], ["crowd", "1F418", "1F992", "1F407", "1F422", "1F98B"], ["duo", "1F513", "1F9D2"],
  ["duo", "1FA79", "1F44C"], ["crowd", "1F9F8", "1FA81", "1F3C0", "1F381"], ["duo", "267E", "1F550"], ["almost", "23F3"],
  ["alone", "1F9D2"], ["journey", "1F6B6", "1F3E0"], ["duo", "1F550", "2705"], ["duo", "1F642", "1F44C"],
  ["duo", "1F381", "1F34E"], ["duo", "267E", "2600"], ["duo", "1F305", "23F0"], ["duo", "1F632", "2728"],
  ["duo", "1F929", "1F308"], ["single", "1F691"], ["among", "1F34F", "1F34F", "1F34E", "1F34F", "1F34F"], ["single", "1F34E"],
  ["joined", "1F34E", "1F381"], ["single", "1F620"], ["duo", "1F418", "1F407"], ["duo", "1F4E6", "1F4E6"],
  ["duo", "1F64B", "1F4AC"], ["crowd", "1F381", "1F34E", "1F3C0", "1F4D6"], ["duo", "1F465", "2753"], ["duo", "1F37D", "1F6AB"],
  ["among", "1F9D1", "1F465", "1F9D1", "1F9D1", "1F9D1"], ["duo", "1F4E6", "2753"], ["journey", "1F937", "1F6B6"], ["duo", "1F5FA", "1F4CD"],
  ["single", "1F3E2"], ["duo", "1F3E2", "1FA9F"], ["single", "1F4F1"], ["single", "1F34E"],
  ["duo", "1F4C5", "1F91D"], ["duo", "2614", "1F337"], ["duo", "1F5FA", "1F4CD"], ["single", "1F4AA"],
  ["single", "1FA91"], ["duo", "1F503", "1F3E0"], ["duo", "1F6EC", "1F9F3"], ["single", "1F3A8"],
  ["single", "1F4F0"], ["duo", "1F9D1", "1F3A8"], ["duo", "2696", "1F34E"], ["duo", "1F4AC", "2753"],
  ["duo", "1F91D", "1F465"], ["joined", "1F34E", "1F381"], ["trio", "1F34E", "1F381", "1F3C0"], ["duo", "1F4CD", "1F3E0"],
  ["duo", "1F4E7", "1F4F1"], ["duo", "1F4E6", "1F6AB"], ["duo", "1F60D", "1F337"], ["duo", "2600", "26F1"],
  ["duo", "1F475", "1F9D2"], ["crowd", "1F341", "1F342", "1F341", "1F342"], ["duo", "1F4BA", "2705"], ["journey", "1F3E0", "2708"],
  ["duo", "1F929", "2728"], ["duo", "1F922", "1F5D1"]
];

if (scenes.length !== data.entries.length) throw new Error(`Scene map has ${scenes.length} entries, expected ${data.entries.length}`);

const palettes = [
  ["#ffdd76", "#fff5ce", "#f46e61", "#1f3552"],
  ["#8fd8f5", "#e4f7ff", "#ff9b57", "#173d59"],
  ["#a7e5ca", "#e5fff2", "#8064cf", "#173c37"],
  ["#e6d3ff", "#f8f0ff", "#ef6d76", "#352651"],
  ["#ffc8a7", "#fff1e7", "#4ba9a1", "#482e2b"]
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}\n${error}`)));
  });
}

const iconCache = new Map();
async function iconData(code) {
  if (!iconCache.has(code)) {
    const svg = await readFile(join(iconDir, `${code}.svg`), "utf8");
    iconCache.set(code, svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, ""));
  }
  return iconCache.get(code);
}

function image(markup, x, y, size, rotate = 0) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  return `<g transform="rotate(${rotate} ${cx} ${cy}) translate(${x} ${y}) scale(${size / 72})">${markup}</g>`;
}

async function sceneMarkup(scene) {
  const [layout, ...codes] = scene;
  const icons = await Promise.all(codes.map(iconData));
  if (layout === "single") return image(icons[0], 205, 78, 230, -2);
  if (layout === "alone") return image(icons[0], 245, 112, 150, 0);
  if (layout === "duo") return `${image(icons[0], 88, 102, 200, -4)}${image(icons[1], 350, 88, 210, 4)}`;
  if (layout === "scale") return `${image(icons[0], 92, 55, 245, -2)}${image(icons[1], 380, 150, 145, 3)}`;
  if (layout === "above") return `${image(icons[0], 242, 20, 150, -3)}${image(icons[1], 220, 210, 200, 2)}<path d="M318 178V205" stroke="#1f3552" stroke-width="9" stroke-linecap="round" stroke-dasharray="2 18"/>`;
  if (layout === "trio") return icons.map((icon, index) => image(icon, 70 + index * 175, index === 1 ? 74 : 136, index === 1 ? 190 : 155, index * 4 - 4)).join("");
  if (layout === "crowd") return icons.map((icon, index) => image(icon, 45 + (index % 3) * 185, 58 + Math.floor(index / 3) * 165, 145, index % 2 ? 3 : -3)).join("");
  if (layout === "journey") return `${image(icons[0], 65, 126, 180, -4)}<path d="M255 213C330 142 385 260 454 188" fill="none" stroke="#1f3552" stroke-width="9" stroke-linecap="round" stroke-dasharray="3 20"/><path d="M442 174l30 6-18 25" fill="none" stroke="#1f3552" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>${image(icons[1], 430, 92, 155, 4)}`;
  if (layout === "joined") return `${image(icons[0], 90, 102, 185, -5)}<path d="M280 200h80" stroke="#1f3552" stroke-width="14" stroke-linecap="round"/><circle cx="320" cy="200" r="22" fill="#fff7df" stroke="#1f3552" stroke-width="8"/>${image(icons[1], 370, 102, 185, 5)}`;
  if (layout === "add") return `${image(icons[0], 55, 132, 140, -5)}${image(icons[1], 195, 132, 140, 4)}<path d="M364 165v70M329 200h70" stroke="#1f3552" stroke-width="13" stroke-linecap="round"/>${image(icons[2], 430, 96, 190, 3)}`;
  if (layout === "among") return icons.map((icon, index) => {
    const positions = [[65, 85], [240, 48], [405, 87], [145, 225], [350, 222]];
    const [x, y] = positions[index];
    return `${index === 2 ? `<circle cx="${x + 72}" cy="${y + 72}" r="86" fill="#fff7df" stroke="#f36b5f" stroke-width="10"/>` : ""}${image(icon, x, y, 145, index % 2 ? 3 : -3)}`;
  }).join("");
  if (layout === "almost") return `${image(icons[0], 230, 72, 210, 0)}<path d="M184 318h272" stroke="#1f3552" stroke-width="12" stroke-linecap="round"/><path d="M190 318h235" stroke="#f36b5f" stroke-width="12" stroke-linecap="round"/>`;
  throw new Error(`Unknown layout ${layout}`);
}

await mkdir(outputDir, { recursive: true });

for (const [index, entry] of data.entries.entries()) {
  const [sky, paper, accent, ink] = palettes[index % palettes.length];
  const artwork = await sceneMarkup(scenes[index]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <rect width="640" height="400" rx="34" fill="${paper}"/>
    <circle cx="520" cy="35" r="235" fill="${sky}" opacity=".62"/>
    <circle cx="95" cy="24" r="120" fill="${accent}" opacity=".12"/>
    <circle cx="566" cy="64" r="32" fill="${accent}" opacity=".88"/>
    <path d="M0 320C92 270 156 348 255 307s179-7 242 16 103-5 143-28v105H0Z" fill="${paper}" opacity=".8"/>
    <path d="M-20 348C95 302 175 383 300 336s201 30 370-20" fill="none" stroke="${ink}" stroke-width="7" opacity=".14"/>
    <g>${artwork}</g>
    <g fill="${ink}" opacity=".08"><circle cx="72" cy="62" r="5"/><circle cx="110" cy="84" r="3"/><circle cx="540" cy="120" r="4"/><circle cx="590" cy="146" r="3"/></g>
    <rect x="7" y="7" width="626" height="386" rx="29" fill="none" stroke="${ink}" stroke-width="7"/>
  </svg>`;
  const temp = join("/tmp", `ket-clue-${process.pid}-${entry.slug}.svg`);
  const output = join(outputDir, `${entry.slug}.webp`);
  await writeFile(temp, svg);
  await run("magick", [temp, "-resize", "640x400!", "-quality", "82", output]);
  await unlink(temp);
  if ((index + 1) % 14 === 0 || index === data.entries.length - 1) console.log(`Created ${index + 1}/${data.entries.length} clue scenes`);
}
