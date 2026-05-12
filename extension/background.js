// MV3 service worker: forwards captured payloads to the configured backend
// and tracks rich diagnostic stats for the popup.
const DEFAULT_BASE = "https://project--2158bffa-7f82-4bc6-9df9-c59319d262f7.lovable.app";
const MAX_RECENT = 8;

async function getConfig() {
  const cfg = await chrome.storage.local.get(["baseUrl", "ingestToken", "stats"]);
  return {
    baseUrl: cfg.baseUrl || DEFAULT_BASE,
    ingestToken: cfg.ingestToken || "",
    stats: cfg.stats || {
      captured: 0,
      sent: 0,
      recognized: 0,
      lastAt: null,
      lastError: null,
      lastFetched: null,
      lastInserted: null,
      lastUpdated: null,
      recentUrls: [],
    },
  };
}

async function patchStats(patch) {
  const { stats } = await getConfig();
  await chrome.storage.local.set({ stats: { ...stats, ...patch } });
}

async function pushRecentUrl(url) {
  const { stats } = await getConfig();
  const recent = [url, ...(stats.recentUrls || []).filter((u) => u !== url)].slice(0, MAX_RECENT);
  await chrome.storage.local.set({ stats: { ...stats, recentUrls: recent } });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "meruki-captured-tick") {
    (async () => {
      const { stats } = await getConfig();
      await chrome.storage.local.set({
        stats: { ...stats, captured: (stats.captured || 0) + 1 },
      });
    })();
    return; // no async response needed
  }

  if (msg?.type !== "meruki-capture") return;

  (async () => {
    try {
      const { baseUrl, ingestToken } = await getConfig();
      if (!ingestToken) {
        await patchStats({
          lastError: "未配置上报令牌（点插件图标设置）",
          lastAt: Date.now(),
        });
        return sendResponse({ ok: false });
      }
      await pushRecentUrl(msg.url);
      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/public/meruki-ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingest_token: ingestToken,
          source_url: msg.url,
          payload: msg.payload,
        }),
      });
      const text = await res.text();
      let body = null;
      try { body = JSON.parse(text); } catch { /* ignore */ }
      if (!res.ok) {
        await patchStats({
          lastError: `HTTP ${res.status}: ${(body && body.error) || text.slice(0, 160)}`,
          lastAt: Date.now(),
        });
        return sendResponse({ ok: false });
      }
      const { stats } = await getConfig();
      await chrome.storage.local.set({
        stats: {
          ...stats,
          sent: (stats.sent || 0) + 1,
          recognized: (stats.recognized || 0) + (body?.recognized ? 1 : 0),
          lastAt: Date.now(),
          lastError: null,
          lastFetched: body?.fetched ?? 0,
          lastInserted: body?.inserted ?? 0,
          lastUpdated: body?.updated ?? 0,
        },
      });
      sendResponse({ ok: true, body });
    } catch (e) {
      await patchStats({ lastError: String(e?.message || e), lastAt: Date.now() });
      sendResponse({ ok: false });
    }
  })();
  return true; // async
});
