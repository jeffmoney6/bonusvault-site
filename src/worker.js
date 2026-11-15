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

export default {
  async fetch(request, env) {
    const country = request.cf && request.cf.country;
    if (!country || BLOCKED.has(country)) {
      return new Response(BLOCK_PAGE, {
        status: 451,
        headers: { "content-type": "text/html;charset=UTF-8" }
      });
    }
    return env.ASSETS.fetch(request);
  }
};
