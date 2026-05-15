## 现状诊断

数据本身只有 1 条包裹 + 2 条子订单，DB 查询不应该慢。"慢"主要来自请求链路和加载策略：

1. **SSR loader 是 fire-and-forget**
   `purchase.japan-parcel.index.tsx` 里：
   ```ts
   loader: ({ context }) => {
     context.queryClient.ensureQueryData({...});  // 没 return、没 await
   }
   ```
   结果是服务端不等数据就先把 HTML 吐出来，浏览器拿到的是"加载中…"骨架，之后还得再发一次 `_serverFn` 请求把数据拉回来。冷启动 worker + 一次往返 ≈ 1-3s 的"白屏感"。

2. **列表 query 仍然偏胖**
   `select` 拼了 28 列父表 + 13 列子表，`limit 500`，且没分页；同时还有 `or(... ilike ...)` 搜索（`item_title / source_order_no / tracking_no / seller / receiver_name`）。当前虽然只 1 行无所谓，但等数据涨起来会线性变慢，并且这些搜索字段没有索引。

3. **进入列表后还会触发两次额外的 serverFn**
   `useEffect` 里"懒翻译前 20 条缺中文标题的子订单"——会调用 `translateTitles` + `bulkSetItemTitlesCn`。即使数据已显示，UI 也会因为 `setQueriesData` 重渲染，看上去像"还在转"。

4. **Router 预取与 Query 缓存重复计时**
   `router.tsx` 设 `defaultPreloadStaleTime: 10_000`，而组件用的是 `useQuery` + `staleTime: 60_000`，loader 又自己设了 `staleTime: 60_000`。两套 SWR 叠加，preload 命中后还是会触发后台 refetch，肉眼能看到一次"刷新"。

## 优化方案

### A. 让首屏数据跟着 SSR 一起到（最大收益）

把 loader 改成"返回/await"形式，并把组件切成 `useSuspenseQuery`，这样：
- 服务端就把首屏 JSON 序列化进 HTML，刷新即出，不再有"加载中…"。
- 浏览器端不再多发一次 `_serverFn` 请求。

```ts
// src/routes/purchase.japan-parcel.index.tsx
const listOptions = (search: string, sources: string[]) => ({
  queryKey: buildListKey(search, sources),
  queryFn: () =>
    listJapanParcels({
      data: { search, source: sources.length ? sources : undefined },
    }),
  staleTime: 60_000,
});

export const Route = createFileRoute("/purchase/japan-parcel/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(listOptions("", [])),
  component: JapanParcelList,
});

// 组件里：
const list = useSuspenseQuery(listOptions(debouncedSearch, sources));
```

同时把 `src/router.tsx` 的 `defaultPreloadStaleTime` 改回 `0`，让 Query 单独管"新鲜度"，避免双层缓存打架。

### B. 收缩 list serverFn 的 payload

把列表 `select` 再瘦身（首屏不需要的列移到详情接口里）：
- 父表只保留：`id, source, source_order_no, tracking_no, status, item_title_cn, item_title, item_image_url, total_jpy, grand_total_jpy, grand_total_cny, tariff_jpy, intl_total_jpy, purchased_at`。
- 子表只保留：`id, item_title, item_title_cn, item_image_url, item_total_jpy`。
其余 `intl_*`、`weight_g`、`tariff_*` 这些只在详情/编辑页用，不在列表渲染。

加个分页/截断：默认 `limit 100`，等需要再说"加载更多"。

### C. 把懒翻译延后，避免视觉抖动

- 用 `requestIdleCallback`(降级 `setTimeout(…, 800)`) 触发，且仅在列表真的有缺译条目时执行。
- 翻译完成后用 `setQueriesData` 静默合并（已经是这样），但**只更新当前可见行**，不要一次性 20 条全打。

### D. 给搜索加索引（可选，数据起来再做）

为 `japan_parcels.source_order_no / tracking_no` 建普通 btree 索引，`item_title` 用 trigram 索引（`pg_trgm`），让 `ilike '%xxx%'` 能走索引而不是顺序扫描。

## 预期效果

- 第一次打开：从"白屏 1-3s + 加载中骨架"变成 SSR 直出，**首屏即数据**。
- 列表内切换/返回：命中 Query 缓存，**无网络请求、瞬开**。
- 后续数据增长后，瘦 select + 索引保证不会线性变慢。

## 实施顺序

1. 改 loader + 组件为 `useSuspenseQuery`，调整 `defaultPreloadStaleTime`（A）。
2. 收窄 `listJapanParcels` 的 `select` 字段并加 `limit 100`（B）。
3. 懒翻译挪到 idle 回调（C）。
4. （可选）后续数据量上来再加索引（D）。
