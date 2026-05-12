// Runs in the page's world (NOT the content-script isolated world) so we can
// monkey-patch fetch + XHR and read response bodies before the page consumes them.
(function () {
  if (window.__BOOMEROFF_MERUKI_INJECTED__) return;
  window.__BOOMEROFF_MERUKI_INJECTED__ = true;

  // URL path filter: keep this generous so we capture as much as possible.
  // The backend decides what looks like an order list.
  const URL_RE = /(order|parcel|package|inProgress|in_progress|buy|purchase|warehouse|cart|deliver|tracking)/i;

  function looksInteresting(url) {
    try {
      const u = new URL(url, location.href);
      if (!/meruki\.cn$/i.test(u.hostname) && !u.hostname.endsWith(".meruki.cn")) return false;
      return URL_RE.test(u.pathname + u.search);
    } catch {
      return false;
    }
  }

  function send(url, payload) {
    try {
      window.postMessage(
        { __boomeroff: true, type: "meruki-capture", url: String(url), payload },
        "*",
      );
    } catch {
      /* ignore */
    }
  }

  function tryParse(text) {
    if (!text || typeof text !== "string") return null;
    const t = text.trimStart();
    if (t[0] !== "{" && t[0] !== "[") return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  // --- patch fetch ---
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const res = await origFetch.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (looksInteresting(url)) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("json") || ct === "") {
          const clone = res.clone();
          clone
            .text()
            .then((txt) => {
              const data = tryParse(txt);
              if (data) send(url, data);
            })
            .catch(() => {});
        }
      }
    } catch {
      /* ignore */
    }
    return res;
  };

  // --- patch XHR ---
  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OrigXHR();
    let _url = "";
    const _open = xhr.open;
    xhr.open = function (method, url) {
      _url = url;
      return _open.apply(xhr, arguments);
    };
    xhr.addEventListener("load", function () {
      try {
        if (!looksInteresting(_url)) return;
        const txt = xhr.responseType === "" || xhr.responseType === "text" ? xhr.responseText : null;
        const data = tryParse(txt);
        if (data) send(_url, data);
      } catch {
        /* ignore */
      }
    });
    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;
})();
