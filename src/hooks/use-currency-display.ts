import { useCallback, useEffect, useSyncExternalStore } from "react";

export type CurrencyDisplay = "jpy" | "cny" | "both";

const KEY = "jp-parcel-currency-display";
const DEFAULT: CurrencyDisplay = "both";

const listeners = new Set<() => void>();

function read(): CurrencyDisplay {
  if (typeof window === "undefined") return DEFAULT;
  const v = window.localStorage.getItem(KEY);
  return v === "jpy" || v === "cny" || v === "both" ? v : DEFAULT;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useCurrencyDisplay(): [CurrencyDisplay, (v: CurrencyDisplay) => void] {
  const value = useSyncExternalStore(
    subscribe,
    read,
    () => DEFAULT,
  );

  // sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) listeners.forEach((l) => l());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const set = useCallback((v: CurrencyDisplay) => {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, v);
    listeners.forEach((l) => l());
  }, []);

  return [value, set];
}
