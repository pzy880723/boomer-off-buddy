## 问题

点击侧边栏导航后页面要等好几秒，原因有三层：

1. **路由没有开启 hover 预加载**。`src/router.tsx` 里只设了 `defaultPreloadStaleTime: 0`，没有 `defaultPreload: "intent"`。结果是：用户**点击**那一刻才开始下载该路由的代码块、解析依赖、跑 loader——dev 模式下 Vite 每个新路由首次还要现场转换 Radix（Dialog/Sheet/Table/DropdownMenu 等）十几个组件，叠加预览代理的网络往返，第一次打开任意子页都要好几秒。

2. **刚加的账号管理 loader 是阻塞式的**。上一轮我把 `/purchase/japan-parcel/accounts` 改成了 `loader: () => listMerukiAccounts()`，TanStack 在导航完成前会**等这个 server fn 返回**才渲染页面，本地 ~250ms、走 Lovable 预览代理通常 500ms~1s，等于每次点"账号管理"都先卡半秒以上。其它页只要后续也加 loader，会有同样问题。

3. **缺少 react-query 默认 staleTime**。每次进入页面 `useQuery` 都会重新发请求（默认 staleTime=0），同一页面来回切也要等。

## 改造方案

### 1. 在 `src/router.tsx` 开启 intent 预加载
```ts
createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  defaultPreload: "intent",        // hover/focus link 即开始拉 chunk + 跑 loader
  defaultPreloadStaleTime: 0,
  defaultPendingMs: 200,           // 200ms 内完成的导航不闪烁 loading
});
```
配合 react-query `defaultOptions: { queries: { staleTime: 30_000 } }`，让 30 秒内重复进入同一页直接走缓存。

效果：把"点击 → 等 chunk → 等 loader → 渲染"瀑布折叠成"hover 时已经在拉 → 点击瞬间渲染"。

### 2. 把账号页 loader 改成非阻塞预取
```tsx
loader: ({ context }) => {
  // 不 await：导航立刻完成，同时后台预热 react-query 缓存
  context.queryClient.prefetchQuery({
    queryKey: ["meruki-accounts"],
    queryFn: () => listMerukiAccounts(),
    staleTime: 10_000,
  });
},
```
组件继续用 `useQuery({ queryKey: ["meruki-accounts"], ... })`，命中缓存即同步渲染，没命中也只是首屏 loading 一下，不会再让导航本身卡住。

### 3. 给侧栏 Link 加 preload hint（可选锦上添花）
`<Link to={...} preload="intent" />`——其实开了全局默认就够了，不必每个 Link 写。

## 技术细节（仅做参考）

- `defaultPreload: "intent"` 是 TanStack Router 官方推荐的"零额外成本预热"方式，鼠标移过去就在后台 import 路由文件并执行 loader，不会改变可见行为。
- `prefetchQuery` 是 fire-and-forget，对应 `tanstack-query-integration` 文档里"非关键数据"的范式；`ensureQueryData` 才会阻塞，那是给"必须有数据才能渲染"的页面用的，账号页用不到。
- dev 模式下首次转换慢是 Vite 特性，预热把这块成本挪到了用户阅读上一页内容的空闲时间里。生产构建会一次打包，开了 intent 预加载后体感几乎瞬开。

## 改的文件

- `src/router.tsx`：加 `defaultPreload`、`defaultPendingMs`、QueryClient 默认 `staleTime`
- `src/routes/purchase.japan-parcel.accounts.tsx`：把 loader 改为 `prefetchQuery`，恢复 `useQuery` 主导（去掉 `initialData` / `Route.useLoaderData`）

不动业务逻辑、不动 UI、不动后端。