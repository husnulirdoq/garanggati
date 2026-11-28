const FEED_URLS = {
  all: "https://cointelegraph.com/rss",
  bitcoin: "https://cointelegraph.com/rss/tag/bitcoin",
  business: "https://cointelegraph.com/rss/tag/business",
  markets: "https://cointelegraph.com/rss/tag/markets",
  regulation: "https://cointelegraph.com/rss/tag/regulation",
  ai: "https://cointelegraph.com/rss/tag/ai",
  technology: "https://cointelegraph.com/rss/tag/technology",
};

const PRODUCTION_ORIGINS = new Set([
  "https://garanggati.web.id",
  "https://www.garanggati.web.id",
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (PRODUCTION_ORIGINS.has(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(origin) {
  const headers = new Headers({
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });
  if (isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function jsonError(status, message, origin) {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") ?? "";

    if (request.method === "OPTIONS") {
      if (origin && !isAllowedOrigin(origin)) {
        return new Response(null, { status: 403, headers: corsHeaders(origin) });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return jsonError(405, "Method not allowed.", origin);
    }

    if (origin && !isAllowedOrigin(origin)) {
      return jsonError(403, "Origin not allowed.", origin);
    }

    const url = new URL(request.url);
    const feedKey = (url.searchParams.get("feed") || "bitcoin").toLowerCase();
    const upstreamUrl = FEED_URLS[feedKey];
    if (!upstreamUrl) {
      return jsonError(
        400,
        `Unknown feed "${feedKey}". Allowed feeds: ${Object.keys(FEED_URLS).join(", ")}.`,
        origin,
      );
    }

    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        method: request.method,
        cf: {
          cacheTtl: 0,
          cacheEverything: false,
        },
        headers: {
          "User-Agent": "Garanggati-RSS-Reader/1.0 (+https://garanggati.web.id)",
          Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
      });

      if (!upstreamResponse.ok) {
        return jsonError(
          502,
          `Upstream Cointelegraph returned HTTP ${upstreamResponse.status}.`,
          origin,
        );
      }

      const headers = corsHeaders(origin);
      headers.set("Content-Type", "application/xml; charset=utf-8");
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      headers.set("Pragma", "no-cache");

      return new Response(request.method === "HEAD" ? null : upstreamResponse.body, {
        status: 200,
        headers,
      });
    } catch (error) {
      return jsonError(502, `Failed to fetch RSS feed: ${error.message}`, origin);
    }
  },
};
