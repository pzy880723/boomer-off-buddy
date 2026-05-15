import { useCallback, useEffect, useState } from "react";

export type ParcelViewMode = "parcel" | "item";

const KEY = "jp-parcel-view-mode";
const DEFAULT: ParcelViewMode = "parcel";

export function useParcelViewMode(): [ParcelViewMode, (v: ParcelViewMode) => void] {
  const [value, setValue] = useState<ParcelViewMode>(DEFAULT);

  useEffect(() => {
    const v = window.localStorage.getItem(KEY);
    if (v === "parcel" || v === "item") setValue(v);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === "parcel" || e.newValue === "item")) {
        setValue(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const set = useCallback((v: ParcelViewMode) => {
    setValue(v);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, v);
  }, []);

  return [value, set];
}
