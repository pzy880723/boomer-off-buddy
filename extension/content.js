// Content script: inject the page-world patcher, then forward captured
// payloads to the background service worker for upload.
(function () {
  try {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("inject.js");
    s.async = false;
    (document.head || document.documentElement).appendChild(s);
    s.onload = () => s.remove();
  } catch (e) {
    console.warn("[meruki-ingest] inject failed", e);
  }

  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || d.__boomeroff !== true) return;
    if (d.type === "meruki-captured-tick") {
      chrome.runtime.sendMessage({ type: "meruki-captured-tick" }, () => void chrome.runtime.lastError);
      return;
    }
    if (d.type !== "meruki-capture") return;
    chrome.runtime.sendMessage(
      { type: "meruki-capture", url: d.url, payload: d.payload },
      () => void chrome.runtime.lastError,
    );
  });
})();
