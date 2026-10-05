# goafk.dev

The website for [afk](https://github.com/goafk/afk): static, dependency-free, built for Cloudflare Pages.

```
src/pages/      index, docs, privacy, 404 (a leading <!--meta {...}--> sets title/description/path)
src/partials/   head, header, footer, logo + icon sprites, included with {{> name}}
static/         copied as-is: assets/, install.sh, _headers, _redirects, robots.txt, manifest
og/og.html      source of static/assets/og.png (the social share image)
build.mjs       → dist/  (no npm install needed; Node 18+)
```

## Develop

```sh
node build.mjs && npx serve dist        # or: cd dist && python3 -m http.server 8788
```

Append `?static` to any URL to turn off motion (handy for screenshots).

## Deploy (Cloudflare Pages)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → **Connect to Git** → `goafk/website`.
2. Build command `node build.mjs`, build output directory `dist`. No environment variables.
3. Custom domains → add `goafk.dev` (and `www.goafk.dev` → redirect to the apex). With the domain on
   Cloudflare DNS, records and HTTPS are set up automatically. `.dev` is HTTPS-only, which Pages handles.

Or from the command line: `node build.mjs && npx wrangler pages deploy dist --project-name goafk`.

`static/_headers` sets security headers (incl. a strict CSP with a hash for the one inline script,
filled in at build time), serves `/install.sh` as `text/plain` with a short cache, and caches
fingerprinted assets for a year.

## Keep install.sh in sync

`/install.sh` must match the installer in the afk repo:

```sh
scripts/sync-install.sh ../afk     # copies ../afk/install.sh → static/install.sh
```

## Updating the page

- **Screenshots** live in `static/assets/shots/<name>-<dark|light>.webp` (924×2000) plus `-sm` (462 wide).
  In pages use `{{shot <name> "alt text"}}`: it emits both themes with srcset.
- **Store buttons**: in `src/pages/index.html` the Google Play / App Store buttons are
  `aria-disabled` "Soon" spans; swap them for links when the listings are live. The APK button points
  to `/docs/#android`.
- **Brand**: colours, type and motion tokens are at the top of `static/assets/css/site.css`
  and mirror `afk-branding.json`.
