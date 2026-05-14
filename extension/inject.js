// Runs in the page's world (NOT the content-script isolated world) so we can
// monkey-patch fetch + XHR and read response bodies before the page consumes them.
(function () {
  if (window.__BOOMEROFF_MERUKI_INJECTED__) return;
  window.__BOOMEROFF_MERUKI_INJECTED__ = true;

  const MAX_BYTES = 800_000;

  // We capture from any page whose hostname contains "meruki". Then any JSON
  // response (regardless of API domain) is forwarded.
  function isMerukiHost(hostname) {
    return /meruki/i.test(hostname || "");
  }

  if (!isMerukiHost(location.hostname)) {
    // Still announce that we injected, so popup can tell user this isn't a Meruki page.
    try {
      window.postMessage(
        { __boomeroff: true, type: "meruki-injected", url: location.href, isMeruki: false },
        "*",
      );
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    window.postMessage(
      { __boomeroff: true, type: "meruki-injected", url: location.href, isMeruki: true },
      "*",
    );
  } catch {
    /* ignore */
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

  function notifyCaptured(url) {
    try {
      window.postMessage(
        { __boomeroff: true, type: "meruki-captured-tick", url: String(url || "") },
        "*",
      );
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

  function absUrl(u) {
    try {
      return new URL(u, location.href).toString();
    } catch {
      return String(u || "");
    }
  }

  // --- patch fetch ---
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const res = await origFetch.apply(this, arguments);
    try {
      const url = absUrl(typeof input === "string" ? input : input?.url ?? "");
      const ct = res.headers.get("content-type") || "";
      // Try to parse anything that could be JSON. Many Meruki APIs may not set
      // a strict Content-Type.
      if (
        ct.includes("json") ||
        ct.includes("text") ||
        ct === "" ||
        ct.includes("javascript")
      ) {
        const clone = res.clone();
        clone
          .text()
          .then((txt) => {
            const data = tryParse(txt);
            notifyCaptured(url);
            if (data) send(url, data);
          })
          .catch(() => {});
      } else {
        // Still tick so popup shows traffic is happening
        notifyCaptured(url);
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
      _url = absUrl(url);
      return _open.apply(xhr, arguments);
    };
    xhr.addEventListener("load", function () {
      try {
        const txt =
          xhr.responseType === "" || xhr.responseType === "text" ? xhr.responseText : null;
        const data = tryParse(txt);
        notifyCaptured(_url);
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
