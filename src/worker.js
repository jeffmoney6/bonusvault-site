// Blocks visitors from countries where the listed casinos are restricted
// or where promoting them is not allowed. Add/remove ISO country codes as needed.
const BLOCKED = new Set([
  "SE", // Sweden
  "US", "GB", "AU", "NL", "FR", "ES", "DE", "IT", "PT", "BE", "DK", "AT",
  "CH", "CZ", "SK", "SI", "GR", "HU", "LT", "LV", "EE", "CY", "MT", "PL",
  "RS", "BY", "CW", "AW", "BQ", "SX", "GI", "SG", "IL", "IR", "IQ", "KP",
  "SY", "CU", "AF", "YE", "MM", "ZW", "UA", "TR", "PH", "AE", "HK", "TW",
  "KW", "PK", "BR"
]);

const BLOCK_PAGE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Not available in your region</title>
<style>body{background:#0b0d12;color:#e9ecf2;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px}
h1{font-size:24px;margin-bottom:8px}p{color:#8e96a8;max-width:440px}</style></head>
<body><div><h1>Not available in your region</h1>
<p>BonusVault is not available in your country. The casinos we compare do not accept players from your location.</p></div></body></html>`;

const PAGES = ["/", "/stake/", "/shuffle/", "/gamdom/", "/roobet/"];

// Search engine crawlers (Google, Bing) crawl from the US, which is blocked.
// Let them through so the site can be indexed – checked by both user agent
// and the network they come from, so a normal visitor can't fake it.
function isSearchBot(request) {
  const ua = request.headers.get("user-agent") || "";
  const org = (request.cf && request.cf.asOrganization) || "";
  if (/Googlebot|Google-InspectionTool|AdsBot-Google|Storebot-Google/i.test(ua) && /Google/i.test(org)) return true;
  if (/bingbot|BingPreview/i.test(ua) && /Microsoft/i.test(org)) return true;
  return false;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = url.origin;

    if (url.pathname === "/robots.txt") {
      return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`, {
        headers: { "content-type": "text/plain;charset=UTF-8" }
      });
    }
    if (url.pathname === "/sitemap.xml") {
      const today = new Date().toISOString().slice(0, 10);
      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        PAGES.map(p => `  <url><loc>${origin}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n") +
        `\n</urlset>\n`;
      return new Response(body, { headers: { "content-type": "application/xml;charset=UTF-8" } });
    }

    const country = request.cf && request.cf.country;
    if (!isSearchBot(request) && (!country || BLOCKED.has(country))) {
      return new Response(BLOCK_PAGE, {
        status: 451,
        headers: { "content-type": "text/html;charset=UTF-8" }
      });
    }
    return env.ASSETS.fetch(request);
  }
};
