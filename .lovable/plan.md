## 现状判断

我查了当前后台数据：

- `meruki_raw_captures` 仍然是 0 条
- `meruki_sync_runs` 只有 5 月 12 日旧记录
- 说明插件没有成功把任何 JSON 上报到后端

当前插件只在 `https://*.meruki.cn/*` 页面注入，且只抓 `meruki.cn` 域名下的接口。问题很可能是：Meruki 实际页面或接口域名不是 `*.meruki.cn`，或者接口走了 `meruki.co.jp`、`api.xxx`、`www.xxx`、子 iframe、blob/relative 请求等，导致插件根本没注入或没命中。

## 修复方案

### 1. 放宽插件可运行域名

更新 `extension/manifest.json`：

- 增加常见 Meruki 相关域名匹配范围
- 允许插件在更多 Meruki 页面注入
- 临时允许捕获页面自身发出的所有 HTTPS JSON 请求，后端仍只接收带正确令牌的上报

目标：先解决「抓到 JSON = 0」的问题，不再被域名猜错卡住。

### 2. 增加插件自检状态

更新 `content.js`、`inject.js`、`background.js`、`popup.html`、`popup.js`：

- popup 显示「插件已注入当前页面」
- popup 显示「当前页面 URL」
- popup 显示「最近抓到的接口 URL」
- 如果当前页面没有注入，直接提示「当前页面不在插件允许范围内」
- 增加「重置统计」按钮，避免旧数字误导判断

这样下一次你打开 popup，我能一眼判断：

- 插件没注入：域名/安装问题
- 已注入但抓到 0：页面没有发 JSON，或请求发生在 iframe/worker
- 抓到 > 0 但发送 0：令牌/网络/后端地址问题
- 发送 > 0 但识别 0：后端解析规则需要按真实接口结构调整

### 3. 后端增加诊断接口

在现有 `/api/public/meruki-ingest` 基础上保持兼容，不改令牌机制。

另外新增轻量诊断：

- 插件可发送一次 `ping`
- 后端返回 `ok: true`
- popup 显示「后端连通：正常 / 异常」

这样可以排除 baseUrl 写错、发布地址不对、CORS 等问题。

### 4. 重新打包插件

重新生成：

```text
public/meruki-ingest-extension.zip
```

你需要重新下载、解压并在 Chrome 扩展页点「重新加载」或重新安装。

### 5. 下一步验证流程

修完后你按这个顺序验证：

1. 重新安装新版插件
2. 打开 Meruki 页面并刷新一次
3. 点插件图标
4. 把 popup 截图发我

我会根据新字段判断下一步：

- 如果看到真实接口 URL，我就按真实 payload 改订单解析
- 如果仍没有注入，我继续把域名范围或 iframe 注入方式扩大
- 如果连通失败，我修后端地址/CORS/令牌校验

## 技术细节

- 主要改动文件：
  - `extension/manifest.json`
  - `extension/inject.js`
  - `extension/content.js`
  - `extension/background.js`
  - `extension/popup.html`
  - `extension/popup.js`
  - `src/routes/api/public/meruki-ingest.ts`
  - `public/meruki-ingest-extension.zip`

- 不改现有订单表结构
- 不改 Meruki 账号表结构
- 不删除现有 Cookie 同步方案，只增强插件抓取方案
- 后端仍使用上报令牌校验，避免别人随便写入数据