// POST /api/notify — "tell me when afk is on the App Store / Google Play".
// Stores { email, platforms, country, dates } in the KV namespace bound as NOTIFY (see README).
// Spam: hidden honeypot field, same-origin check, 5 sign-ups per visitor per hour (IP is hashed, never stored).

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?goafk\.dev$/, /^https:\/\/[a-z0-9-]+\.goafk\.pages\.dev$/, /^https:\/\/goafk\.pages\.dev$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.some((re) => re.test(origin))) return json({ error: "origin" }, 403);
  if (!env.NOTIFY) return json({ error: "not_configured" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid" }, 400);
  }
  if (body && body.company) return json({ ok: true }); // honeypot: bots fill every field

  const email = String((body && body.email) || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "email" }, 400);
  const platforms = (Array.isArray(body.platforms) ? body.platforms : []).filter((p) => p === "ios" || p === "android");

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rateKey = "rl:" + (await sha256("afk-notify:" + ip)).slice(0, 32);
  const count = Number((await env.NOTIFY.get(rateKey)) || 0);
  if (count >= 5) return json({ error: "rate" }, 429);
  await env.NOTIFY.put(rateKey, String(count + 1), { expirationTtl: 3600 });

  const key = "email:" + email;
  const prev = await env.NOTIFY.get(key, "json");
  const now = new Date().toISOString();
  await env.NOTIFY.put(
    key,
    JSON.stringify({
      email,
      platforms: [...new Set([...((prev && prev.platforms) || []), ...platforms])],
      country: (request.cf && request.cf.country) || null,
      createdAt: (prev && prev.createdAt) || now,
      updatedAt: now,
    }),
  );
  return json({ ok: true });
}

export const onRequest = () => json({ error: "method" }, 405);
