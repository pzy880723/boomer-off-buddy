// Runs in the page's world (NOT the content-script isolated world) so we can
// monkey-patch fetch + XHR and read response bodies before the page consumes them.
(function () {
  if (window.__BOOMEROFF_MERUKI_INJECTED__) return;
  window.__BOOMEROFF_MERUKI_INJECTED__ = true;

  const MAX_BYTES = 500_000; // skip very large payloads

  function isMeruki(url) {
    try {
      const u = new URL(url, location.href);
      return /(^|\.)meruki\.cn$/i.test(u.hostname);
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

  function notifyCaptured() {
    try {
      window.postMessage({ __boomeroff: true, type: "meruki-captured-tick" }, "*");
    } catch {
      /* ignore */
    }
  }

  function tryParse(text) {
    if (!text || typeof text !== "string") return null;
    if (text.length > MAX_BYTES) return null;
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
      if (isMeruki(url)) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("json") || ct === "" || ct.includes("text")) {
          const clone = res.clone();
          clone
            .text()
            .then((txt) => {
              const data = tryParse(txt);
              if (data) {
                notifyCaptured();
                send(url, data);
              }
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
        if (!isMeruki(_url)) return;
        const txt =
          xhr.responseType === "" || xhr.responseType === "text" ? xhr.responseText : null;
        const data = tryParse(txt);
        if (data) {
          notifyCaptured();
          send(_url, data);
        }
      } catch {
        /* ignore */
      }
    });
    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;
})();
