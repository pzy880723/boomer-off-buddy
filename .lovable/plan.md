# 修复"智能识别"点击无响应

## 根因
`src/routes/purchase.japan-parcel.new.tsx` 用 `React.lazy()` + `Suspense` 动态加载 `SmartRecognizePanel`。当 dev server 之前因别的错误崩过一次（日志里 `PARCEL_SOURCE_LABEL is not defined` / exit 143），浏览器的 dynamic import 已被 reject 并缓存，`lazy()` 不会重试，所以再次点击"展开"时 `setSmartOpen(true)` 触发 Suspense，但 chunk 永远拿不到 → 视觉上"完全没反应"。该面板是这个页面的核心功能，几乎必用，lazy 收益微乎其微。

## 改动（仅 1 个文件）
`src/routes/purchase.japan-parcel.new.tsx`：

1. 删除 `lazy` / `Suspense` 相关 import。
2. 把
   ```ts
   const SmartRecognizePanel = lazy(() => import(...).then(m => ({ default: m.SmartRecognizePanel })));
   ```
   改为静态 import：
   ```ts
   import { SmartRecognizePanel, type RecognizedResult } from "@/components/japan-parcel/smart-recognize-panel";
   ```
3. 渲染处去掉 `<Suspense fallback={...}>` 包装，直接 `<SmartRecognizePanel onApply={handleRecognized} />`。
4. 折叠态卡片移除 `onMouseEnter` 里的 `void import(...)` 预热（不再需要）。
5. `smartOpen` state 与展开/折叠交互保持不变。

## 不动的部分
- `smart-recognize-panel.tsx`、`recognize.functions.ts`、`recognize-timeline.tsx` 全部维持现状。
- 不改业务逻辑、不改 UI 视觉。

## 验证
- 访问 `/purchase/japan-parcel/new`，点击"展开"立即出现面板。
- 折叠 → 再展开多次 OK。
- dev server 日志无新增 error。
