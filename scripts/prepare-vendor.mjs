import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "public", "vendor");
await mkdir(directory, { recursive: true });
const assets = [
  ["jspdf", "dist/jspdf.umd.min.js", "jspdf.4.2.1.umd.min.js"],
  ["chart.js", "dist/chart.umd.min.js", "chart.4.5.1.umd.min.js"],
];
let html = await readFile(path.join(root, "public", "index.html"), "utf8");
const manifest = {};
for (const [name, source, filename] of assets) {
  const packageRoot = path.join(root, "node_modules", name);
  const metadata = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  if (!filename.includes(`.${metadata.version}.`)) throw new Error(`Version inattendue : ${name}`);
  const bytes = await readFile(path.join(packageRoot, source));
  await writeFile(path.join(directory, filename), bytes);
  const integrity = `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
  const script = `<script defer src="/vendor/${filename}" integrity="${integrity}"></script>`;
  const pattern = name === "jspdf"
    ? /<script defer src="(?:https:\/\/cdn\.jsdelivr\.net\/npm\/jspdf[^\"]*|\/vendor\/jspdf[^\"]*)"[^>]*><\/script>/
    : /<script defer src="(?:https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js[^\"]*|\/vendor\/chart[^\"]*)"[^>]*><\/script>/;
  if (!pattern.test(html)) throw new Error(`Balise de bibliothèque introuvable : ${name}`);
  html = html.replace(pattern, script);
  const license = name === "jspdf" ? "LICENSE" : "LICENSE.md";
  await copyFile(path.join(packageRoot, license), path.join(directory, `${name}.LICENSE.txt`));
  manifest[name] = { version: metadata.version, file: filename, integrity };
}
await writeFile(path.join(root, "public", "index.html"), html);
await writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("Bibliothèques locales et empreintes SRI préparées.");
