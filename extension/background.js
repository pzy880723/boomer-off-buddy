// MV3 service worker: forwards captured payloads to the configured backend.
const DEFAULT_BASE = "https://project--2158bffa-7f82-4bc6-9df9-c59319d262f7.lovable.app";

async function getConfig() {
  const cfg = await chrome.storage.local.get(["baseUrl", "ingestToken", "stats"]);
  return {
    baseUrl: cfg.baseUrl || DEFAULT_BASE,
    ingestToken: cfg.ingestToken || "",
    stats: cfg.stats || { sent: 0, recognized: 0, lastAt: null, lastError: null },
  };
}

async function bumpStats(patch) {
  const { stats } = await getConfig();
  const next = { ...stats, ...patch };
  await chrome.storage.local.set({ stats: next });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "meruki-capture") return;
  (async () => {
    try {
      const { baseUrl, ingestToken } = await getConfig();
      if (!ingestToken) {
        await bumpStats({ lastError: "未配置上报令牌（请打开插件图标设置）", lastAt: Date.now() });
        return sendResponse({ ok: false });
      }
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
        await bumpStats({
          lastError: `HTTP ${res.status}: ${(body && body.error) || text.slice(0, 120)}`,
          lastAt: Date.now(),
        });
        return sendResponse({ ok: false });
      }
      const { stats } = await getConfig();
      await chrome.storage.local.set({
        stats: {
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
      await bumpStats({ lastError: String(e?.message || e), lastAt: Date.now() });
      sendResponse({ ok: false });
    }
  })();
  return true; // async
});
