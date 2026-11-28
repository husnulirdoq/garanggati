export const rssProxyUrl = "https://garanggati-rss-proxy.husnulirdoq.workers.dev";

export const rssProxyConfigured =
  typeof rssProxyUrl === "string" &&
  rssProxyUrl.length > 0 &&
  !rssProxyUrl.startsWith("REPLACE_WITH_") &&
  /^https?:\/\//.test(rssProxyUrl);
