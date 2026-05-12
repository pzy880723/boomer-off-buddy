# 修复「账号管理」点击无反应

## 根因

TanStack Router 的扁平路由约定下，`src/routes/purchase.japan-parcel.tsx` 自动成为 `purchase.japan-parcel.accounts.tsx`、`.new.tsx`、`.$id.tsx` 三个子路由的父布局。但当前父文件 `component: JapanParcelList` 直接渲染列表，没有 `<Outlet />`，所以子路由匹配后无处挂载，UI 看起来停留在列表页。

网络日志也佐证：URL 实际已切到 `/purchase/japan-parcel/accounts`，`listMerukiAccounts` 也已返回 `rows:[]`，只是组件没渲染出来。

## 修复方案

把父路由拆成「布局 + 首页」：

1. **新建** `src/routes/purchase.japan-parcel.index.tsx`
   - 把当前 `purchase.japan-parcel.tsx` 中 `JapanParcelList` 组件及其相关 imports / hooks 整体迁过去
   - `createFileRoute("/purchase/japan-parcel/")`，`component: JapanParcelList`

2. **改写** `src/routes/purchase.japan-parcel.tsx` 为纯布局：
   ```tsx
   import { createFileRoute, Outlet } from "@tanstack/react-router";
   export const Route = createFileRoute("/purchase/japan-parcel")({
     component: () => <Outlet />,
   });
   ```

3. 不动 `accounts` / `new` / `$id` 三个文件；`routeTree.gen.ts` 由插件自动重新生成。

## 验证

- 访问 `/purchase/japan-parcel` → 显示订单列表（行为不变）
- 点击「账号管理」 → 跳到 `/accounts` 并正确渲染账号管理页面
- 「新建包裹」「详情」同样可正常打开
