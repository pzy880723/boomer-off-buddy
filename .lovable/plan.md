## 为什么慢

点击"新建包裹"后，浏览器要现下载并解析这个路由的 chunk，再渲染。它现在很重：

- `src/routes/purchase.japan-parcel.new.tsx`：792 行
- 顶层一次性 import 了：
  - 5 个 server function 模块（`recognize.functions` 621 行 / `tariff.functions` / `translate.functions` / `japan-parcel.functions` 等），每个都带 zod schema + prompt 文本
  - `ScreenshotDropzone`、`RecognizeTimeline`、`ItemImageUploader`、`Tabs`、`Select` 等只在"智能识别"面板里才用得到的组件
- 路由没有 loader（数据不是瓶颈），慢的 100% 是 JS 下载 + 解析
- 列表页的"新建包裹"按钮虽然在 router 里开了 `defaultPreload: "intent"`，但用户直接点（没 hover）就吃不到预加载红利

## 优化方案

只动前端结构与按需加载，不改业务逻辑。

### 1. 路由级代码分割（最大收益）

新增 `src/routes/purchase.japan-parcel.new.lazy.tsx`，把 `NewParcelPage` 主体迁过去，用 TanStack Router 的 lazy 路由：

```tsx
// purchase.japan-parcel.new.tsx —— 只留壳
export const Route = createFileRoute("/purchase/japan-parcel/new")({
  head: () => ({ meta: [{ title: "新建小包裹 · BOOMER OFF" }] }),
});

// purchase.japan-parcel.new.lazy.tsx
export const Route = createLazyFileRoute("/purchase/japan-parcel/new")({
  component: NewParcelPage,
});
```

效果：路由匹配立即出现外壳，主 chunk 异步下载。

### 2. 智能识别面板按需加载

把"智能识别"那块（含 `ScreenshotDropzone` / `RecognizeTimeline` / 所有 5 个识别相关 server function 的 import）抽成 `SmartRecognizePanel.tsx`，在主页面用 `React.lazy` + `Suspense` 包裹，默认折叠未渲染时不下载。

这能让用户上来直接看到"手动新建"表单，识别相关 ~700 行代码 + prompt 文本完全不进入首屏 chunk。

### 3. server function client 桩按需 import

`recognize.functions.ts` 在前端虽然只生成 RPC 桩，但它顶部的 zod schema + 文本 prompt 也会被打包。把这些 import 收进 `SmartRecognizePanel`，主页面不再引用即可一同 tree-shake。

### 4. 触发更早的预下载

`src/routes/purchase.japan-parcel.index.tsx` 的"新建包裹"按钮加上 `onMouseDown` / `onPointerDown` 调 `router.preloadRoute({ to: "/purchase/japan-parcel/new" })`，覆盖"直接 click 不经 hover"的场景，让 mousedown 到 click 这十几毫秒就开始下载。

### 5. 顺手清掉无用 import

新建页 `Tabs/TabsContent/...` 等组件如果只在智能识别区使用，会随 #2 一起移走，主壳不再依赖。

## 文件改动

- 新建 `src/routes/purchase.japan-parcel.new.lazy.tsx`
- 改写 `src/routes/purchase.japan-parcel.new.tsx`（仅保留 Route 定义 + head）
- 新建 `src/components/japan-parcel/smart-recognize-panel.tsx`
- 编辑 `src/routes/purchase.japan-parcel.index.tsx`（按钮加 preloadRoute）

## 不动的部分

- 业务逻辑（识别管线、关税计算、提交逻辑）原样迁移，不改算法
- server function 实现文件本身不动
- 列表页其它部分不动

## 预期效果

首次点击时下载的 JS 体积大幅减少（粗估 -60% 以上），路由壳和手动表单几乎瞬开；智能识别面板首次展开时再加载剩余代码，体感等待从"卡很久白屏"变成"几乎即点即开"。
