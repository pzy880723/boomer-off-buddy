# 修复插件「已发送 0」问题

## 现状

- 数据库里没有任何插件上报记录（`japan_parcels` 0 条，`meruki_sync_runs` 最近的两条是旧的 cookie 同步）
- 插件 popup 显示「已发送 0」且无错误 → 插件已加载、令牌已配，但 `inject.js` 里的 URL 过滤没匹配到任何 meruki 接口
- 当前过滤词：`order|parcel|package|inProgress|buy|purchase|warehouse|cart|deliver|tracking`，meruki 实际接口路径很可能不含这些词

## 方案

### 1. 放宽抓取规则（`extension/inject.js`）

- 删除 URL 关键词白名单
- 改为**抓取 meruki.cn 域下所有 JSON 响应**（按 `Content-Type: application/json` 或返回体首字符 `{` `[` 判断）
- 设置上限：单条 payload > 500KB 跳过，避免爆量
- 抓取后由后端 `findOrderArray` 决定是不是订单，不是订单也不报错

### 2. 增加诊断字段（`extension/popup.html` + `popup.js` + `background.js`）

新增三个统计：
- **抓到 JSON**：`inject.js` 捕获了多少条 JSON
- **已发送**：成功 POST 到后端的次数
- **识别为订单**：后端识别成功的次数
- **最近 5 条上报的 URL**（缩略显示，便于我们一眼看出 meruki 真实接口路径）

让我下次能立刻判断：
- 抓到 JSON = 0 → 用户根本没访问 meruki 或域名不对
- 抓到 > 0 / 发送 = 0 → 网络/令牌问题
- 发送 > 0 / 识别 = 0 → 接口路径找到了但订单识别算法没认出，需调

### 3. 后端宽容化（`src/routes/api/public/meruki-ingest.ts`）

- 即使没识别为订单，也把 payload 落到 `meruki_sync_runs.message` 的截断版本（已经做了）
- 额外把**未识别但来自疑似订单页**的原始 payload 存到一张轻量表 `meruki_raw_captures (id, account_id, source_url, payload jsonb, captured_at)`，方便我直接 SQL 查看真实结构后改解析逻辑

### 4. 重新打包扩展

```
rm -f public/meruki-ingest-extension.zip
cd extension && nix run nixpkgs#zip -- -r ../public/meruki-ingest-extension.zip .
```

## 用户操作

1. 重新下载插件 zip → 在 chrome://extensions 点扩展卡片右下角「🔄」重新加载（或删除后重装）
2. 打开 meruki，**进入「我的订单 / 进行中订单 / 包裹列表」任意页面**并刷新一次
3. 点插件图标，把「抓到 JSON / 已发送 / 识别为订单 / 最近 URL」截图发我

我看到 URL 后就能精准调整解析，**不再盲猜**。

## 技术细节

- `inject.js` URL 过滤改成 `() => true`（仅域名判断）
- 大小限制：`if (txt.length > 500000) return;`
- popup 新增 chrome.storage 字段：`stats.captured`、`stats.recentUrls: string[]`（上限 5）
- 新表迁移（如确认要做诊断表）：

```sql
create table public.meruki_raw_captures (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.meruki_accounts(id) on delete cascade,
  source_url text not null,
  payload jsonb not null,
  recognized boolean not null default false,
  captured_at timestamptz not null default now()
);
alter table public.meruki_raw_captures enable row level security;
create policy open_all on public.meruki_raw_captures for all using (true) with check (true);
```
