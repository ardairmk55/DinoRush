// Yayın öncesi statik denetim: node tools/audit.js [kök]
// - HTML/CSS/JS içindeki yerel dosya yolları var mı
// - assets/ altında hiçbir yerden referans verilmeyen çalışma zamanı dosyaları
// - yinelenen id, aria-labelledby/controls hedefleri, adsız düğme, alt'sız görsel
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const exists = f => fs.existsSync(path.join(ROOT, f));
const problems = [], notes = [];

const html = read("index.html");
const css = read("css/style.css");
const jsFiles = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
const js = jsFiles.filter(exists).map(f => [f, read(f)]);

// 1) Referanslar
const refs = new Set();
for (const m of html.matchAll(/(?:href|src)="([^"#:]+)"/g)) refs.add(m[1]);
for (const m of css.matchAll(/url\(([^)]+)\)/g)) { const u = m[1].replace(/["']/g, ""); if (!u.startsWith("data:")) refs.add(path.posix.normalize(path.posix.join("css", u))); }
for (const [, src] of js) for (const m of src.matchAll(/["'`](assets\/[^"'`]+\.(?:png|webp|jpg|svg|json))["'`]/g)) refs.add(m[1]);
for (const r of refs) if (!exists(r)) problems.push("Eksik dosya: " + r);
for (const f of jsFiles) if (!exists(f)) problems.push("Eksik betik: " + f);

// 2) Kullanılmayan çalışma zamanı varlıkları (kaynak klasörler hariç)
function walk(dir) { return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.posix.join(dir, d.name)) : [path.posix.join(dir, d.name)]); }
const runtimeAssets = walk("assets").filter(f => !/^assets\/(art_src|ui_src)\//.test(f) && !f.endsWith(".js") && !f.endsWith(".json"));
const allText = html + css + js.map(x => x[1]).join("\n");
const unused = runtimeAssets.filter(f => !refs.has(f) && !allText.includes(f) && !allText.includes(path.posix.basename(f)));
for (const f of unused) notes.push("Referanssız varlık: " + f);

// 3) İşaretleme
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
for (const d of new Set(dup)) problems.push("Yinelenen id: " + d);
for (const m of html.matchAll(/aria-(?:labelledby|controls|describedby)="([^"]+)"/g)) for (const id of m[1].split(/\s+/)) if (!ids.includes(id)) problems.push("Var olmayan ARIA hedefi: " + id);
for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
  const attrs = m[1], text = m[2].replace(/<[^>]+>/g, "").trim();
  if (!text && !/aria-label(?:ledby)?=/.test(attrs)) problems.push("Adsız düğme: " + attrs.slice(0, 80));
  if (!/type="/.test(attrs)) notes.push("type'sız düğme: " + (attrs.match(/id="([^"]+)"/) || [, attrs.slice(0, 50)])[1]);
}
for (const m of html.matchAll(/<img\b([^>]*)>/g)) if (!/\salt="/.test(m[1])) problems.push("alt'sız görsel: " + m[1].slice(0, 60));
if (!/<html lang="tr"/.test(html)) problems.push("html lang eksik");
for (const k of ['name="viewport"', 'name="description"', "<title>"]) if (!html.includes(k)) problems.push("Eksik head öğesi: " + k);

console.log(JSON.stringify({ kok: ROOT, sorun: problems, not: notes }, null, 1));
process.exit(problems.length ? 1 : 0);
