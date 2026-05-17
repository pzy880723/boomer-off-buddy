## 目标

把这个 TanStack Start 项目部署到腾讯云（`erp.boomeroff.com`），同时解决"看不到 `SUPABASE_SERVICE_ROLE_KEY`"的问题。

## 核心难点回顾

这个项目不是纯前端 SPA，它是 **TanStack Start 全栈应用**：
- 浏览器里跑的 React 页面 → 只需要 publishable key（已经有了）
- 服务端 server functions（`src/lib/*.functions.ts`）→ 用 `supabaseAdmin` 客户端访问数据库，必须有 `SUPABASE_SERVICE_ROLE_KEY`

所以腾讯云上必须跑一个 Node 服务（不能只是 nginx 发静态文件），它需要这 3 个环境变量：
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ← 这个 Lovable UI 里看不见

另外还有 2 个业务密钥也要带过去：
- `MERUKI_ENC_KEY`（meruki 账号密码加密用）
- `LOVABLE_API_KEY`（AI 识别调用）

## 解决方案：用 Lovable 的轮换工具拿新 key

Lovable 后台有个 `rotate_api_keys` 工具，可以**生成一套全新的 Supabase API keys**（包括 publishable + service_role），并自动写入项目的 `.env` 和 Lovable Cloud 部署。

执行后我能在工具返回里看到新的 service_role key，直接告诉你，你拷贝到腾讯云的 `.env` 就行。

**副作用**：
- Lovable 自己托管的 `boomer-off-buddy.lovable.app` 会自动用新 key，无感切换，不会挂
- 老的 service_role key 立即失效，外面如果有别处用就会断（这个项目应该没有）
- 浏览器扩展、Edge Functions 等也自动用新 key

## 执行步骤

```text
┌─ Lovable 端 ──────────────────────────────┐
│ 1. 我调用 rotate_api_keys                  │
│ 2. 拿到新 SERVICE_ROLE_KEY，发给你         │
│ 3. Lovable Cloud 自动用新 key 重新部署     │
└────────────────────────────────────────────┘
                    ↓
┌─ 腾讯云端（你执行）──────────────────────────┐
│ 4. git clone 项目到服务器                   │
│ 5. 写 .env（5 个环境变量）                  │
│ 6. bun install && bun run build            │
│ 7. PM2 跑 node .output/server/index.mjs    │
│ 8. nginx 反代 erp.boomeroff.com → :3000    │
└────────────────────────────────────────────┘
```

## 我会准备好给你的东西

1. **新的 service_role key**（轮换后第一时间发你）
2. **完整 `.env` 模板**，照抄改值即可
3. **腾讯云一键部署脚本**：包含 git clone、依赖安装、build、PM2 启动、nginx 配置（SSL + WebSocket + 缓存）
4. **回滚方案**：如果新 key 出问题，再调一次 rotate 就行

## 需要你确认两件事

1. **是否 OK 轮换 Supabase keys**？（不会丢数据，只是换钥匙，Lovable 自己的部署无感切换）
2. **腾讯云那台机器**：是不是有 Node 18+ 环境？没有的话我把 nvm 安装命令一起塞进脚本

确认后我直接执行 `rotate_api_keys` 并把新 key + 脚本发你。
