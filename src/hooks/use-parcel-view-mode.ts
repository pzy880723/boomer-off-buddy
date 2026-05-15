import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ParcelViewMode = "parcel" | "item";

const KEY = "jp-parcel-view-mode";
const DEFAULT: ParcelViewMode = "parcel";

const listeners = new Set<() => void>();

function read(): ParcelViewMode {
  if (typeof window === "undefined") return DEFAULT;
  const v = window.localStorage.getItem(KEY);
  return v === "parcel" || v === "item" ? v : DEFAULT;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useParcelViewMode(): [ParcelViewMode, (v: ParcelViewMode) => void] {
  const value = useSyncExternalStore(subscribe, read, () => DEFAULT);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) listeners.forEach((l) => l());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const set = useCallback((v: ParcelViewMode) => {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, v);
    listeners.forEach((l) => l());
  }, []);

  return [value, set];
}
