// BonusVault – per-casino country blocking.
// Each casino has its own list of restricted countries (from the casinos' terms).
// A visitor only sees the casinos that accept players from their country.
// Always re-check against each casino's own "restricted countries" list.

// Blocked for everyone, whatever the casino (Sweden + sanctioned countries).
const ALWAYS_BLOCKED = new Set(["SE", "KP", "IR", "SY", "CU"]);

const CASINO_BLOCKED = {
  stake: new Set([
    "US", "GB", "AU", "BR", "DE", "FR", "IT", "ES", "NL", "DK", "PT", "BE", "AT",
    "CZ", "CY", "GR", "BY", "LT", "RS", "SK", "CH", "CW",
    "CN", "IQ", "IL", "PK", "PH"
  ]),
  shuffle: new Set([
    "US", "GB", "AU", "DE", "NL", "PT", "ES", "SG", "CY", "CW", "KY", "VG"
  ]),
  gamdom: new Set([
    "US", "GB", "AU", "AT", "BE", "DK", "FR", "DE", "GR", "HU", "NL", "PT", "RS",
    "SK", "SI", "ES", "AW", "BQ", "CW", "GF", "PF", "GI", "MM", "PR", "RE"
  ]),
  roobet: new Set([
    "US", "GB", "AU", "BE", "DK", "DE", "NL", "ES", "PT", "PL", "SK", "HU", "LT",
    "LV", "MT", "CY", "GI", "FR", "IT", "AL", "BR", "AW", "BQ", "CW", "SX",
    "IQ", "IL", "MM", "SS", "YE", "ZW", "NI"
  ])
};
// Ontario (Canada) is restricted by Stake, Shuffle and Roobet.
const ONTARIO_BLOCKED = new Set(["stake", "shuffle", "roobet"]);

const CASINOS = Object.keys(CASINO_BLOCKED);
const PAGES = ["/", "/stake/", "/shuffle/", "/gamdom/", "/roobet/"];

const BLOCK_PAGE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Not available in your region</title>
<style>body{background:#0b0d12;color:#e9ecf2;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px}
h1{font-size:24px;margin-bottom:8px}p{color:#8e96a8;max-width:440px}a{color:#f5c451}</style></head>
<body><div><h1>Not available in your region</h1>
<p>This page is not available in your country because the casino does not accept players from your location.</p></div></body></html>`;

function blocked(status = 451) {
  return new Response(BLOCK_PAGE, { status, headers: { "content-type": "text/html;charset=UTF-8" } });
}

// Search engine crawlers (Google, Bing) crawl from the US. Let them through so the
// site can be indexed – checked by user agent AND network, so visitors can't fake it.
function isSearchBot(request) {
  const ua = request.headers.get("user-agent") || "";
  const org = (request.cf && request.cf.asOrganization) || "";
  if (/Googlebot|Google-InspectionTool|AdsBot-Google|Storebot-Google/i.test(ua) && /Google/i.test(org)) return true;
  if (/bingbot|BingPreview/i.test(ua) && /Microsoft/i.test(org)) return true;
  return false;
}

function allowedCasinos(cf) {
  const country = cf && cf.country;
  if (!country || ALWAYS_BLOCKED.has(country)) return [];
  const ontario = country === "CA" && cf.regionCode === "ON";
  return CASINOS.filter(c => !CASINO_BLOCKED[c].has(country) && !(ontario && ONTARIO_BLOCKED.has(c)));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = url.origin;
    const path = url.pathname;

    if (path === "/robots.txt") {
      return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`, {
        headers: { "content-type": "text/plain;charset=UTF-8" }
      });
    }
    if (path === "/sitemap.xml") {
      const today = new Date().toISOString().slice(0, 10);
      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        PAGES.map(p => `  <url><loc>${origin}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n") +
        `\n</urlset>\n`;
      return new Response(body, { headers: { "content-type": "application/xml;charset=UTF-8" } });
    }
    // Google Search Console verification file – must be reachable for Google's checker.
    if (/^\/google[0-9a-f]+\.html$/.test(path)) {
      return env.ASSETS.fetch(request);
    }
    // Static files (CSS, images) are harmless on their own.
    if (path.startsWith("/assets/")) {
      return env.ASSETS.fetch(request);
    }

    if (isSearchBot(request)) {
      return env.ASSETS.fetch(request);
    }

    const allowed = allowedCasinos(request.cf);
    if (allowed.length === 0) return blocked();

    // Casino page: only for countries that casino accepts.
    const m = path.match(/^\/(stake|shuffle|gamdom|roobet)(\/|\/index\.html)?$/);
    if (m && !allowed.includes(m[1])) return blocked();

    const res = await env.ASSETS.fetch(request);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("text/html")) return res;

    // Remove casinos this visitor can't use from the page.
    let rw = new HTMLRewriter();
    for (const c of CASINOS) {
      if (!allowed.includes(c)) {
        rw = rw.on(`[data-casino="${c}"]`, { element(e) { e.remove(); } });
      }
    }
    rw = rw.on("[data-needs]", {
      element(e) {
        const needs = (e.getAttribute("data-needs") || "").split(",");
        if (!needs.some(n => allowed.includes(n.trim()))) e.remove();
      }
    });
    rw = rw.on("[data-count]", { element(e) { e.setInnerContent(String(allowed.length)); } });
    const out = rw.transform(res);
    const headers = new Headers(out.headers);
    headers.set("cache-control", "private, no-store");
    headers.append("vary", "cf-ipcountry");
    return new Response(out.body, { status: out.status, headers });
  }
};
