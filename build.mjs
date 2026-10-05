// Builds the static site into dist/ — no dependencies.
//   src/pages/*.html    pages; a leading <!--meta {...} --> block sets title, description, path
//   src/partials/*      shared pieces, included with {{> name}}
//   static/             copied as-is (assets, install.sh, _headers, _redirects, …)
// Cloudflare Pages: build command `node build.mjs`, output directory `dist`.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, "dist");
const SITE = "https://goafk.dev";

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, "static"), out, { recursive: true });

// Fingerprint CSS/JS so they can be cached forever.
const hash = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(out, f))).digest("hex").slice(0, 10);
const assets = { "/assets/css/site.css": hash("assets/css/site.css"), "/assets/js/site.js": hash("assets/js/site.js") };

const partials = Object.fromEntries(
  fs.readdirSync(path.join(root, "src/partials")).map((f) => [f.replace(/\.[^.]+$/, ""), fs.readFileSync(path.join(root, "src/partials", f), "utf8")]),
);

const pages = [];
for (const file of fs.readdirSync(path.join(root, "src/pages"))) {
  let html = fs.readFileSync(path.join(root, "src/pages", file), "utf8");
  const m = html.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
  const meta = { title: "afk", description: "", path: "/", ...(m ? JSON.parse(m[1]) : {}) };
  if (m) html = html.slice(m[0].length);
  // Partials may include other partials and use the page's meta.
  for (let i = 0; i < 4; i++) html = html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => partials[n] ?? `<!-- missing partial ${n} -->`);
  html = html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k === "url" ? SITE + meta.path : k === "year" ? String(new Date().getFullYear()) : (meta[k] ?? "")));
  // {{shot name "alt" [eager]}} → the dark + light screenshot (AVIF with WebP fallback, 1x/2x).
  html = html.replace(/\{\{shot ([\w-]+) "([^"]*)"( eager)?\}\}/g, (_, n, alt, eager) =>
    ["dark", "light"]
      .map((t) => {
        const base = `/assets/shots/${n}-${t}`;
        const sizes = 'sizes="(min-width: 960px) 340px, 78vw"';
        return (
          `<picture class="shot-${t}">` +
          `<source type="image/avif" srcset="${base}-sm.avif 462w, ${base}.avif 924w" ${sizes}>` +
          `<img src="${base}-sm.webp" srcset="${base}-sm.webp 462w, ${base}.webp 924w" ${sizes} width="924" height="2000" alt="${alt}" decoding="async"${eager ? ' fetchpriority="high"' : ' loading="lazy"'}>` +
          `</picture>`
        );
      })
      .join(""),
  );
  html = html.split('<div class="phone-screen">').join('<div class="phone-screen"><span class="sb-icons" aria-hidden="true"></span>');
  for (const [a, h] of Object.entries(assets)) html = html.split(a).join(`${a}?v=${h}`);
  // Screenshots are cached for a year: version each URL by its content, so new shots show up at once.
  html = html.replace(/\/assets\/shots\/[\w.-]+\.(?:webp|avif|png)/g, (u) => `${u}?v=${hash(u.slice(1))}`);
  const dest = file === "index.html" || file === "404.html" ? file : path.join(file.replace(/\.html$/, ""), "index.html");
  fs.mkdirSync(path.dirname(path.join(out, dest)), { recursive: true });
  fs.writeFileSync(path.join(out, dest), html);
  if (file !== "404.html") pages.push(meta.path);
}

// CSP: allow exactly the inline theme script (hash of its contents).
const inline = partials.head.match(/<script>([\s\S]*?)<\/script>/)[1];
const cspHash = crypto.createHash("sha256").update(inline).digest("base64");
const headersFile = path.join(out, "_headers");
fs.writeFileSync(headersFile, fs.readFileSync(headersFile, "utf8").replace("sha256-THEME_HASH", `sha256-${cspHash}`));

fs.writeFileSync(
  path.join(out, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .sort()
    .map((p) => `  <url><loc>${SITE}${p}</loc></url>`)
    .join("\n")}\n</urlset>\n`,
);
console.log(`built ${pages.length + 1} pages → dist/`);
