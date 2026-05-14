const $ = (id) => document.getElementById(id);

function shortUrl(u) {
  try {
    const x = new URL(u);
    return x.host + x.pathname + (x.search ? x.search.slice(0, 40) : "");
  } catch {
    return u;
  }
}

async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch {
    return null;
  }
}

const DEFAULT_BASE =
  "https://project--2158bffa-7f82-4bc6-9df9-c59319d262f7-dev.lovable.app";

async function load() {
  const cfg = await chrome.storage.local.get(["baseUrl", "ingestToken", "stats"]);
  // 一次性迁移：旧的未发布生产域名 → 稳定预览 -dev 域名
  let baseUrl = cfg.baseUrl || DEFAULT_BASE;
  if (
    /project--2158bffa-7f82-4bc6-9df9-c59319d262f7\.lovable\.app/.test(baseUrl) &&
    !/-dev\.lovable\.app/.test(baseUrl)
  ) {
    baseUrl = DEFAULT_BASE;
    await chrome.storage.local.set({ baseUrl });
  }
  $("token").value = cfg.ingestToken || "";
  $("base").value = baseUrl;
  const s = cfg.stats || {};
  $("cap").textContent = s.captured || 0;
  $("sent").textContent = s.sent || 0;
  $("rec").textContent = s.recognized || 0;
  $("last").textContent = s.lastAt ? new Date(s.lastAt).toLocaleTimeString() : "—";
  $("ins").textContent =
    s.lastFetched != null
      ? `${s.lastFetched} 抓 / ${s.lastInserted || 0} 新 / ${s.lastUpdated || 0} 改`
      : "—";
  if (s.lastError) {
    $("errBox").style.display = "flex";
    $("err").textContent = s.lastError;
  } else {
    $("errBox").style.display = "none";
  }
  const urls = s.recentUrls || [];
  $("urls").innerHTML = urls.length
    ? urls.map((u) => `<div title="${u}">${shortUrl(u)}</div>`).join("")
    : "<em>暂无</em>";

  // 当前页面注入状态
  const tab = await getActiveTab();
  const pageUrl = tab?.url || "—";
  $("pageUrl").textContent = pageUrl;
  const injMap = s.injectedTabs || {};
  const inj = tab?.id != null ? injMap[tab.id] : null;
  const isMerukiUrl = /meruki/i.test(pageUrl);
  if (!tab) {
    $("injState").className = "badge warn";
    $("injState").textContent = "无活动标签";
  } else if (inj?.isMeruki) {
    $("injState").className = "badge ok";
    $("injState").textContent = "✓ 已注入 Meruki 页面";
  } else if (inj && !inj.isMeruki) {
    $("injState").className = "badge warn";
    $("injState").textContent = "插件已加载，但当前页非 Meruki";
  } else if (isMerukiUrl) {
    $("injState").className = "badge warn";
    $("injState").textContent = "未注入，请刷新此页面";
  } else {
    $("injState").className = "badge warn";
    $("injState").textContent = "请打开 Meruki 页面";
  }
}

$("save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    ingestToken: $("token").value.trim(),
    baseUrl: $("base").value.trim(),
  });
  $("save").textContent = "已保存 ✓";
  setTimeout(() => ($("save").textContent = "保存"), 1200);
});

$("reset").addEventListener("click", async () => {
  await new Promise((r) => chrome.runtime.sendMessage({ type: "meruki-reset" }, r));
  load();
});

$("ping").addEventListener("click", async () => {
  $("pingState").className = "badge warn";
  $("pingState").textContent = "测试中…";
  const res = await new Promise((r) => chrome.runtime.sendMessage({ type: "meruki-ping" }, r));
  if (res?.ok) {
    $("pingState").className = "badge ok";
    $("pingState").textContent = `✓ 连通 (HTTP ${res.status})`;
  } else if (res?.status === 401 || res?.body?.error === "unknown ingest_token") {
    $("pingState").className = "badge warn";
    $("pingState").textContent = "可达但令牌无效";
  } else {
    $("pingState").className = "badge bad";
    $("pingState").textContent = res?.error
      ? `失败：${res.error.slice(0, 60)}`
      : `HTTP ${res?.status || "?"}`;
  }
});

load();
chrome.storage.onChanged.addListener(load);
