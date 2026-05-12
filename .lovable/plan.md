# 增强 Cookie 输入容错

## 问题

用户从 Chrome DevTools 的 **Application → Cookies 表格** 整片复制粘贴时，得到的是制表符/换行分隔的多列文本（Name、Value、Domain、Path、Expires、Size、Priority），不是合法的 HTTP `Cookie` 请求头格式。直接塞进 `fetch` 的 headers 触发 `Headers.append: "..." is an invalid header value`，账号添加失败。

## 修复方案

在 `src/lib/meruki.server.ts` 加一个 `normalizeCookieInput(raw: string): string` 工具，在所有用到 cookie 的地方（登录测试 / 同步 / 保存）都先经过它。

规则按优先级判断：

1. **已是标准格式**：内容里出现 `name=value` 且没有大量换行 → 去掉首尾空白后直接返回（仅过滤掉控制字符 `\r\n\t` → 替换成空格 / `; `）。
2. **DevTools 表格格式**：含多个换行，按行 split。每行按制表符或 2+ 空格 split → 取前两列 `name` `value`。跳过：表头行（`Name`/`Value`）、空行、name 包含空格、value 是日期串（带 `T` 和 `Z` 的 ISO）、value 是纯数字（很可能是 Size 列被错位读到）。
3. **JSON 格式**：以 `[` 开头能解析为数组且每项有 `name`+`value` → 取这两个字段。
4. 拼接成 `name1=value1; name2=value2` 返回；如果一个有效项都没有，抛出友好错误：`Cookie 解析失败：请在 meruki 页面控制台执行 copy(document.cookie) 后粘贴`。
5. 最后做一次合法性校验：每个 name 必须匹配 `^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$`，value 不允许出现 `\r\n`，否则丢弃该项。

## UI 提示

`src/routes/purchase.japan-parcel.accounts.tsx` 里 Cookie 输入框下方的 helper 文案改成：

> 在 meruki 页面按 F12 → Console 输入 `copy(document.cookie)` 回车，再粘贴到这里。也支持直接粘贴 DevTools Cookies 表格。

## 验证

- 粘贴 `a=1; b=2` → 通过
- 粘贴一段 DevTools 表格文本（即用户这次报错的那段）→ 解析出 `__snaker__id`、`_ga`、`_ga_HP0V8DT7SS`、`deviceId`、`gdxidpyhxdE`、`kmgSessionNO03HxWh` 等键值，拼出合法 Cookie 头，登录测试不再 throw `invalid header value`
- 粘贴乱七八糟的纯文本 → 抛出友好错误而不是底层 `Headers.append` 报错
