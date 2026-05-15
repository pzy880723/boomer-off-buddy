## 问题

`useParcelViewMode` 用 `useSyncExternalStore` + 服务端 snapshot 总是返回 `"parcel"`，SSR 渲染后客户端再"水合"切回 localStorage 值。在 TanStack Start 的 SSR 流程下，这会导致首屏始终是 parcel，且某些情况下 hydration 后没有正确更新到 stored 值。

## 改动

仅改 `src/hooks/use-parcel-view-mode.ts`，简化为 useState + useEffect 模式：

```ts
const KEY = "jp-parcel-view-mode";
const DEFAULT: ParcelViewMode = "parcel";

export function useParcelViewMode(): [ParcelViewMode, (v: ParcelViewMode) => void] {
  const [value, setValue] = useState<ParcelViewMode>(DEFAULT);

  // 客户端挂载后从 localStorage 读初值
  useEffect(() => {
    const v = window.localStorage.getItem(KEY);
    if (v === "parcel" || v === "item") setValue(v);
    // 跨标签同步
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
```

效果：切换商品维度后写 localStorage，刷新页面 useEffect 再次读到并恢复，直到再次切换。

`view-mode-toggle.tsx` 和 `index.tsx` 调用方式不变。
