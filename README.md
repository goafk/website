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

**Live:** https://goafk.dev (Pages project `goafk`, account "the Cloudflare account"). Deploy from
this folder with `npm run deploy` (wrangler, logged in via `npx wrangler login`). The KV namespace for
sign-ups is already bound in `wrangler.toml`.

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

## "Notify me" sign-ups (Pages Function + KV)

`functions/api/notify.js` stores sign-ups in a KV namespace bound as `NOTIFY`. One-time setup:

```sh
npx wrangler kv namespace create NOTIFY            # prints an id
```

Then in Cloudflare → Workers & Pages → goafk → Settings → Bindings → add **KV namespace**,
variable name `NOTIFY`, the namespace above (for Production and Preview). Until it's bound, the form
answers "Sign-ups open very soon".

Export the list when the app ships:

```sh
npx wrangler kv key list --namespace-id <id> --prefix email: | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).map(k=>k.name.slice(6)).join("\n")))'
```

Local test with the function: `node build.mjs && npx wrangler pages dev dist --kv NOTIFY`.

## Analytics

Cloudflare → Workers & Pages → goafk → Metrics → **Web Analytics → Enable**. It's cookieless; the CSP
in `static/_headers` already allows its script, and the privacy page mentions it.
