const $ = (id) => document.getElementById(id);

async function load() {
  const cfg = await chrome.storage.local.get(["baseUrl", "ingestToken", "stats"]);
  $("token").value = cfg.ingestToken || "";
  $("base").value = cfg.baseUrl || "https://project--2158bffa-7f82-4bc6-9df9-c59319d262f7.lovable.app";
  const s = cfg.stats || {};
  $("sent").textContent = s.sent || 0;
  $("rec").textContent = s.recognized || 0;
  $("last").textContent = s.lastAt ? new Date(s.lastAt).toLocaleTimeString() : "—";
  $("ins").textContent =
    s.lastFetched != null ? `${s.lastFetched} 抓 / ${s.lastInserted || 0} 新 / ${s.lastUpdated || 0} 改` : "—";
  if (s.lastError) {
    $("errBox").style.display = "flex";
    $("err").textContent = s.lastError;
  } else {
    $("errBox").style.display = "none";
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

load();
chrome.storage.onChanged.addListener(load);
