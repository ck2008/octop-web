# Octop Web MVP — Claude Code 實作規格

> 目標：將 Octop 第一階段改造成純 Web 架構，鎖定 **GitHub Pages + Supabase Auth/Postgres + Agent Chat + OpenAI Edge Function**。
>
> 本文件是給 Claude Code 直接執行的工程規格。請依照本文件逐項完成，不要自行擴充到 Phase 2 以後的功能。

---

## 0. 執行原則

### 0.1 必須遵守

1. 先閱讀本文件，再開始修改程式。
2. 先檢查現有 repository 結構，不要假設專案一定是空的。
3. 若已有 React/Vite/TypeScript 結構，優先沿用，不要重新建立第二套前端。
4. 若已有 Supabase 目錄或 migration，先閱讀並避免破壞既有 migration。
5. 所有資料庫結構變更必須使用 migration。
6. 所有敏感資訊不得 commit 到 Git。
7. Browser 端不得持有 OpenAI API Key、Supabase secret/service role key。
8. Supabase browser client 只能使用：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
9. OpenAI API Key 只能存在 Supabase Edge Function secrets。
10. 所有 exposed table 必須啟用 Row Level Security。
11. MVP 完成前，不要實作本文件「不在範圍內」的項目。
12. 每完成一個階段，都要執行 build / typecheck / lint（若專案有 lint）並修正錯誤。
13. 不要因為小問題停下來詢問；若不影響架構，採最合理、安全的預設並在最後報告假設。
14. 若碰到會影響資料模型、安全性或部署方式的重大不確定性，先保留既有功能，採最小修改。

### 0.2 最終交付

完成後輸出：

- 已完成項目
- 新增/修改檔案清單
- Migration 清單
- Edge Function 清單
- 必須由使用者手動設定的 GitHub Secrets / Variables
- 必須由使用者手動設定的 Supabase Secrets
- 本地啟動方式
- GitHub Pages 部署方式
- 驗收結果
- 尚未完成或受限項目

---

# 1. MVP 範圍

只實作以下功能：

```text
GitHub Pages
    │
    ▼
React + TypeScript + Vite
    │
    ├── Supabase Auth
    │
    ├── Supabase Postgres
    │
    └── Supabase Edge Function
              │
              ▼
           OpenAI API
```

功能範圍：

1. Email + Password 註冊
2. Email + Password 登入
3. 登出
4. 登入狀態保持
5. Project 管理
6. Agent 管理
7. Conversation 管理
8. Chat 訊息
9. OpenAI 回覆
10. Chat 歷史紀錄
11. Supabase RLS
12. GitHub Pages 自動部署
13. 基本 Loading / Error handling
14. Responsive Web UI

---

# 2. 明確不在 MVP 範圍內

以下功能 **禁止在本階段實作**：

- RAG
- pgvector
- Knowledge Base
- Storage
- 檔案上傳
- Local Runner
- Codex CLI
- Claude Code Runner
- MCP
- Skills
- Plugins
- Cron
- Browser Automation
- Terminal
- Remote Desktop
- Multi-Agent orchestration
- Agent Teams
- Supabase Realtime
- IM Channel
- Discord
- Telegram
- Line
- WeCom
- DingTalk
- Feishu
- GitHub OAuth
- Google OAuth
- SSO
- Billing
- Token 計費
- Organization / Team
- Admin console
- Streaming response

MVP 的 Chat 回應先採：

```text
一次 Request
→ OpenAI
→ 完整 Response
→ 寫入 database
→ 回傳 browser
```

不要做 SSE/WebSocket streaming。

---

# 3. 技術棧

## Frontend

- React 18+
- TypeScript
- Vite
- React Router
- `@supabase/supabase-js`
- CSS 可沿用現有方案
- 若原專案已有 Ant Design，繼續使用 Ant Design
- 不要額外加入大型 UI framework

## Backend

不設置獨立 FastAPI / Node server。

使用：

- Supabase Auth
- Supabase PostgreSQL
- Supabase Edge Functions
- Deno / TypeScript

## AI

使用 OpenAI Responses API。

模型不要散落在程式碼各處。

建立單一設定：

```text
OPENAI_MODEL
```

Edge Function 預設 fallback：

```text
gpt-5.6-luna
```

若環境變數有設定 `OPENAI_MODEL`，優先使用環境變數。

---

# 4. Repository 目錄規劃

優先沿用既有結構。

若是新專案，建立：

```text
/
├─ src/
│  ├─ components/
│  ├─ pages/
│  ├─ layouts/
│  ├─ hooks/
│  ├─ lib/
│  │  └─ supabase.ts
│  ├─ services/
│  │  ├─ projects.ts
│  │  ├─ agents.ts
│  │  ├─ conversations.ts
│  │  └─ chat.ts
│  ├─ types/
│  │  └─ database.ts
│  ├─ App.tsx
│  └─ main.tsx
│
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/
│  │  └─ <timestamp>_initial_schema.sql
│  └─ functions/
│     └─ chat/
│        └─ index.ts
│
├─ .github/
│  └─ workflows/
│     └─ deploy-pages.yml
│
├─ .env.example
├─ package.json
├─ vite.config.ts
└─ README.md
```

---

# 5. 環境變數

## 5.1 Frontend

`.env.example`

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

禁止：

```env
OPENAI_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SECRET_KEY=
```

出現在 frontend `.env`。

### Frontend 規則

Browser bundle 中只允許：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Publishable key 可以存在前端，但 database security 必須依靠 RLS。

---

# 6. Supabase Secrets

Supabase Edge Function 需要：

```text
OPENAI_API_KEY
OPENAI_MODEL
```

設定方式應於 README 記錄，例如：

```bash
supabase secrets set OPENAI_API_KEY=xxxxx
supabase secrets set OPENAI_MODEL=gpt-5.6-luna
```

禁止把值寫入：

- Git
- migration
- TypeScript source
- README sample
- GitHub Pages environment variables

---

# 7. Database Schema

建立以下五張核心 table：

```text
profiles
projects
agents
conversations
messages
```

---

# 8. profiles

Supabase Auth user 建立後，自動建立 profile。

Schema：

```sql
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
```

建立 trigger：

```text
auth.users INSERT
    ↓
public.profiles INSERT
```

Trigger function 使用：

```sql
security definer
```

並明確設定：

```sql
set search_path = ''
```

避免 search_path security issue。

---

# 9. projects

```sql
create table public.projects (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
```

規則：

- `owner_id` 必須是登入使用者
- Project name trim 後不得為空
- 第一版只支援 owner
- 不實作 project_members

---

# 10. agents

```sql
create table public.agents (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,

    name text not null,
    description text,
    system_prompt text not null default '',
    model text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
```

規則：

- Agent 必須屬於 Project
- `owner_id` 必須與 project owner 相符
- `model` 可以為 null
- model 為 null 時 Edge Function 使用 `OPENAI_MODEL`

---

# 11. conversations

```sql
create table public.conversations (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    agent_id uuid not null references public.agents(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,

    title text not null default 'New Chat',

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
```

---

# 12. messages

```sql
create table public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,

    role text not null,
    content text not null,

    created_at timestamptz not null default now(),

    constraint messages_role_check
        check (role in ('user', 'assistant'))
);
```

MVP 不儲存：

```text
system
tool
developer
```

system prompt 存在 agents table。

---

# 13. Index

Migration 至少建立：

```sql
create index idx_projects_owner_id
on public.projects(owner_id);

create index idx_agents_project_id
on public.agents(project_id);

create index idx_agents_owner_id
on public.agents(owner_id);

create index idx_conversations_agent_id
on public.conversations(agent_id);

create index idx_conversations_owner_id
on public.conversations(owner_id);

create index idx_messages_conversation_created
on public.messages(conversation_id, created_at);
```

---

# 14. updated_at

建立共用 trigger function：

```text
set_updated_at()
```

套用：

- profiles
- projects
- agents
- conversations

---

# 15. Row Level Security

所有 `public` tables：

```sql
alter table ... enable row level security;
```

需要保護：

```text
profiles
projects
agents
conversations
messages
```

不得依賴前端 filter 作為權限控制。

---

# 16. RLS — profiles

使用者只能讀寫自己的 profile。

概念：

```sql
auth.uid() = id
```

允許：

- SELECT own
- UPDATE own

不允許 browser 任意 INSERT profile。

profile 由 Auth trigger 建立。

---

# 17. RLS — projects

Owner 才能：

- SELECT
- INSERT
- UPDATE
- DELETE

INSERT 要求：

```sql
owner_id = auth.uid()
```

SELECT/UPDATE/DELETE：

```sql
owner_id = auth.uid()
```

---

# 18. RLS — agents

必須同時確認：

```text
agents.owner_id = auth.uid()
```

且 project 屬於本人。

不要只相信 browser 傳進來的 `project_id`。

INSERT policy 需要確認對應 project：

```sql
exists (
  select 1
  from public.projects p
  where p.id = project_id
    and p.owner_id = auth.uid()
)
```

---

# 19. RLS — conversations

同樣需要：

```text
owner_id = auth.uid()
```

並驗證：

- project belongs to user
- agent belongs to user
- agent.project_id = conversation.project_id

---

# 20. RLS — messages

messages 只能存取屬於本人 conversation 的資料。

SELECT：

```text
owner_id = auth.uid()
AND conversation belongs to auth.uid()
```

INSERT：

```text
owner_id = auth.uid()
AND conversation belongs to auth.uid()
```

不要允許使用者把 message 插到別人的 conversation。

---

# 21. Grants

除了 RLS 之外，也必須檢查 table grants。

MVP：

- `anon` 不允許直接讀寫應用資料
- `authenticated` 只給實際需要的 CRUD 權限
- 不要因為有 RLS 就假設 grants 可以忽略

至少確認：

```text
profiles
projects
agents
conversations
messages
```

對 anon 不暴露應用資料。

---

# 22. Auth

MVP 使用 Supabase Email / Password。

頁面：

```text
/login
/register
```

功能：

### Register

```text
email
password
confirm password
```

驗證：

- email 必填
- password 至少 8 字元
- password / confirm password 相同

### Login

```text
email
password
```

### Logout

呼叫 Supabase：

```text
signOut()
```

---

# 23. Auth Guard

以下頁面必須登入：

```text
/
 /projects
 /projects/:projectId
 /projects/:projectId/agents/:agentId
 /chat/:conversationId
```

未登入：

```text
redirect /login
```

已登入造訪 `/login`：

```text
redirect /
```

---

# 24. Session

使用 Supabase client session management。

需要：

- 首次載入檢查 session
- auth state change listener
- refresh token 交給 Supabase SDK 處理
- 不自行將 access token 存到自訂 localStorage key
- 不自行實作 JWT decode 來判斷權限

---

# 25. Project UI

首頁登入後顯示：

```text
Projects
```

功能：

- Project list
- Create project
- Edit project
- Delete project
- Open project

Project 卡片至少顯示：

```text
name
description
updated_at
```

刪除需 confirmation。

---

# 26. Agent UI

Project detail 顯示：

```text
Agents
```

Agent CRUD：

```text
name
description
system_prompt
model
```

model 欄位：

- optional
- 預設空白
- UI 顯示「使用系統預設模型」

---

# 27. Conversation UI

選 Agent 後可以：

```text
New Chat
```

建立：

```text
conversation
```

title 初始：

```text
New Chat
```

Conversation list：

- title
- updated_at

允許：

- 建立
- 開啟
- 刪除

MVP 不必實作 rename。

---

# 28. Chat UI

Layout：

```text
┌──────────────────────────────────────┐
│ Project / Agent                      │
├──────────────┬───────────────────────┤
│ Conversations│ Chat                  │
│              │                       │
│ New Chat     │ user                  │
│ Chat 1       │ assistant             │
│ Chat 2       │                       │
│              │ [ textarea ] [Send]   │
└──────────────┴───────────────────────┘
```

Mobile 可改成單欄。

---

# 29. Send Message 流程

Browser 不直接呼叫 OpenAI。

完整流程：

```text
User types message
    ↓
Frontend validate
    ↓
invoke Supabase Edge Function: chat
    ↓
Edge Function authenticate user
    ↓
validate conversation ownership
    ↓
load agent
    ↓
load conversation history
    ↓
insert user message
    ↓
call OpenAI Responses API
    ↓
insert assistant message
    ↓
update conversation.updated_at
    ↓
return assistant message
    ↓
Frontend render
```

重要：

**不要讓 browser 先自行 INSERT user message，再呼叫 Edge Function。**

由 Edge Function 統一：

1. 驗證
2. 寫 user message
3. 呼叫 OpenAI
4. 寫 assistant message

避免流程被繞過或訊息狀態不同步。

---

# 30. Edge Function API

Function：

```text
supabase/functions/chat/index.ts
```

Request：

```json
{
  "conversationId": "uuid",
  "message": "Hello"
}
```

Response success：

```json
{
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "..."
  }
}
```

Failure：

```json
{
  "error": "..."
}
```

HTTP status：

```text
400 validation error
401 not authenticated
403 not owner / forbidden
404 conversation or agent not found
429 rate limited
500 internal error
502 upstream OpenAI failure
```

---

# 31. Edge Function Authentication

`chat` 必須是 authenticated endpoint。

Frontend：

```text
supabase.functions.invoke('chat')
```

必須攜帶目前登入使用者 session。

Edge Function 需採 Supabase 官方目前建議的 authenticated-user pattern。

要求：

- 驗證 user JWT
- DB query 必須以 user authorization context 執行
- RLS 必須生效
- 除非確實必要，不使用 service role/secret key
- 不得信任 request body 的 user_id
- user identity 必須從 verified auth context 取得

---

# 32. OpenAI Request

使用 OpenAI Responses API。

概念資料：

```text
instructions = agent.system_prompt

input =
歷史 conversation messages
+
current user message
```

OpenAI API Key：

```text
Deno.env.get("OPENAI_API_KEY")
```

Model：

```text
agent.model
    ??
Deno.env.get("OPENAI_MODEL")
    ??
"gpt-5.6-luna"
```

不要允許 client request 自行指定任意 model。

---

# 33. Conversation History

Edge Function 載入該 conversation messages：

```sql
order by created_at asc
```

MVP 可限制：

```text
最近 30 則 messages
```

防止 context 無限制成長。

如果超過 30：

```text
取最新 30
```

不做 summarization。

---

# 34. OpenAI Error Handling

若 OpenAI 呼叫失敗：

- user message 可以保留
- 不新增假的 assistant message
- Edge Function 回傳適當 error
- Frontend 顯示「回覆失敗，可重新送出」
- 不把完整 API error / secret 顯示給 browser

Server log 可以記：

```text
request id
status
error type
```

不要 log：

```text
OPENAI_API_KEY
Supabase secret
password
JWT
```

---

# 35. Basic Rate Limit

MVP 不必建立 Redis rate limiter。

但 frontend 必須：

- request 送出期間 disable Send
- 防止 double submit

Edge Function 可先不做複雜 rate limit。

README 註明：

```text
Production phase should add server-side per-user rate limiting.
```

---

# 36. Frontend Service Layer

不要讓 components 到處直接呼叫 Supabase。

建立：

```text
src/services/projects.ts
src/services/agents.ts
src/services/conversations.ts
src/services/chat.ts
```

例如：

```ts
export async function listProjects() {}
export async function createProject() {}
export async function updateProject() {}
export async function deleteProject() {}
```

---

# 37. Supabase Client

建立：

```text
src/lib/supabase.ts
```

集中：

```ts
createClient(...)
```

啟動時若缺少必要 env：

顯示清楚錯誤：

```text
Missing VITE_SUPABASE_URL
Missing VITE_SUPABASE_PUBLISHABLE_KEY
```

不要讓畫面只白屏。

---

# 38. TypeScript Types

優先產生 Supabase DB types。

例如：

```bash
supabase gen types typescript
```

若 CI 無法自動連 Supabase，可暫時建立 local types。

避免大量：

```ts
any
```

---

# 39. UI 狀態

所有 async operation 至少有：

```text
loading
success
error
```

Chat Send：

```text
idle
sending
error
```

---

# 40. Error Boundary

至少提供全域 fallback。

不要發生 runtime error 直接白畫面。

---

# 41. GitHub Pages

使用 GitHub Actions deploy。

建立：

```text
.github/workflows/deploy-pages.yml
```

觸發：

```yaml
on:
  push:
    branches:
      - main
  workflow_dispatch:
```

需要：

```text
checkout
setup-node
npm ci
npm run build
upload-pages-artifact
deploy-pages
```

permissions：

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

environment：

```text
github-pages
```

---

# 42. GitHub Pages Base Path

Vite 必須支援 repository project pages。

假設：

```text
https://<user>.github.io/<repo>/
```

不要硬編碼 `/`。

`vite.config.ts` 根據環境設定 base。

推薦：

```ts
base: process.env.GITHUB_ACTIONS ? '/<repo-name>/' : '/'
```

但若能從 GitHub repository context 動態取得 repo name 更好。

不要要求使用者每次 fork 後手動改 source code。

可在 workflow 注入：

```text
VITE_BASE_PATH
```

或透過：

```text
GITHUB_REPOSITORY
```

推導 repository name。

---

# 43. React Router 與 GitHub Pages

GitHub Pages 沒有 server rewrite。

MVP 優先使用：

```text
HashRouter
```

URL 例如：

```text
/#/login
/#/projects
/#/chat/xxx
```

這比另外建立 404 redirect hack 穩定。

不要在 MVP 使用 BrowserRouter + 自製 404 redirect。

---

# 44. GitHub Actions Variables / Secrets

Frontend build 需要：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

因為這兩個是 publishable browser configuration，不屬於真正 server secret。

可使用：

```text
GitHub Repository Variables
```

名稱：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

若現有環境使用 Secrets，也可以支援，但 README 要說明。

---

# 45. CORS

Edge Function 只允許必要方法：

```text
POST
OPTIONS
```

Headers 至少允許：

```text
authorization
apikey
content-type
```

Production 應限制 origin。

MVP 至少支援：

```text
localhost dev
GitHub Pages origin
```

不要使用：

```text
Access-Control-Allow-Origin: *
```

搭配敏感 credential flow。

可透過 Edge Function secret：

```text
ALLOWED_ORIGINS
```

例如：

```text
http://localhost:5173,https://user.github.io
```

若 repo pages 有 path，Origin 本身仍只包含 scheme + host + port。

---

# 46. Supabase Auth Redirect URL

README 必須說明在 Supabase Dashboard：

```text
Authentication
→ URL Configuration
```

設定：

```text
Site URL
```

以及必要 redirect URL。

由於 MVP 是 Email/Password，不依賴 OAuth callback，但仍需正確設定 GitHub Pages production URL。

---

# 47. Security Checklist

Claude Code 完成前逐項確認：

- [ ] OpenAI key 不在 browser bundle
- [ ] Supabase secret/service role key 不在 browser bundle
- [ ] `.env` 有加入 `.gitignore`
- [ ] `.env.example` 不含真實 credentials
- [ ] 所有 app tables RLS enabled
- [ ] anon 無權讀 app data
- [ ] owner_id 不能偽造取得別人資料
- [ ] Edge Function 不信任 user_id request field
- [ ] Edge Function 驗證 conversation ownership
- [ ] Edge Function 驗證 agent ownership
- [ ] Agent 必須屬於 conversation project
- [ ] OpenAI model 不由 browser 任意控制
- [ ] Error response 不洩露 secret
- [ ] SQL migration 可以由空 DB 重建
- [ ] build artifact 不含 `.env`
- [ ] GitHub Actions 不輸出 secret

---

# 48. Database Consistency

Edge Function 在送 chat 時：

先驗證：

```text
conversation.owner_id == auth.uid()
agent.owner_id == auth.uid()
project.owner_id == auth.uid()
conversation.agent_id == agent.id
conversation.project_id == agent.project_id
```

不要單純只查 conversation id。

---

# 49. Conversation Title

MVP：

第一則訊息送出後，若 title 還是：

```text
New Chat
```

則用 user message 產生簡單 title：

```text
前 40 個字
```

規則：

- trim
- 移除換行
- 不呼叫 AI 額外產 title
- 超過 40 字截斷
- 空白則保留 New Chat

---

# 50. Delete 行為

Foreign key：

```text
Project DELETE
    ↓ cascade
Agents
    ↓
Conversations
    ↓
Messages
```

UI delete project 必須顯示：

```text
Deleting this project will also delete its agents,
conversations and messages.
```

Agent delete：

```text
delete conversations/messages cascade
```

必須 confirmation。

---

# 51. UX

最低需求：

### Header

```text
App name
Current user email
Logout
```

### Empty States

必須有：

```text
No projects yet
No agents yet
No conversations yet
```

並提供主要 CTA。

---

# 52. App 名稱

暫定：

```text
Octop Web
```

集中設定，不要散落 hardcode。

例如：

```text
src/config/app.ts
```

---

# 53. README

更新 README，至少包含：

1. Architecture
2. Prerequisites
3. Supabase project setup
4. Environment variables
5. Local development
6. Database migration
7. Edge Function deployment
8. Supabase secrets
9. GitHub Pages setup
10. GitHub repository variables
11. Authentication URL configuration
12. Security notes
13. Production limitations
14. MVP scope
15. Out-of-scope list

---

# 54. Local Development

README 必須提供：

```bash
npm install
npm run dev
```

Supabase：

```bash
supabase start
supabase db reset
supabase functions serve chat
```

若本地 Edge Function 使用 OpenAI：

使用 local Supabase env file，但不得 commit。

例如：

```text
supabase/.env.local
```

加入 `.gitignore`。

---

# 55. Scripts

`package.json` 至少要有：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

若既有專案已有 lint：

保留：

```text
npm run lint
```

不要為了本規格移除既有 QA script。

---

# 56. GitHub Action Build

Build 前注入：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Workflow 不部署 Edge Function。

第一版：

```text
GitHub Actions
    ↓
Frontend only
    ↓
GitHub Pages
```

Edge Function deployment 先由：

```bash
supabase functions deploy chat
```

手動執行。

避免 MVP 一開始就處理跨平台 deployment credentials。

---

# 57. Testing

至少完成下列測試。

## Auth

- [ ] register
- [ ] login
- [ ] wrong password
- [ ] logout
- [ ] refresh browser still authenticated
- [ ] unauthenticated protected route redirects login

## Project

- [ ] create
- [ ] list
- [ ] update
- [ ] delete

## Agent

- [ ] create
- [ ] list per project
- [ ] update
- [ ] delete

## Conversation

- [ ] create
- [ ] list per agent
- [ ] delete

## Chat

- [ ] send user message
- [ ] Edge Function calls OpenAI
- [ ] assistant reply saved
- [ ] page refresh loads history
- [ ] OpenAI failure shown correctly
- [ ] double submit blocked

## Security

建立 User A / User B。

必測：

- [ ] A cannot read B projects
- [ ] A cannot read B agents
- [ ] A cannot read B conversations
- [ ] A cannot read B messages
- [ ] A cannot insert message into B conversation
- [ ] A cannot invoke Edge Function against B conversationId

這組測試是 MVP 完成必要條件。

---

# 58. Acceptance Criteria

以下全部通過才算完成。

## Deployment

```text
GitHub Pages URL
    ↓
可以開啟 React App
```

## Auth

```text
Register
→ Login
→ Logout
```

正常。

## Project

```text
Create Project
→ Refresh
→ Project remains
```

## Agent

```text
Project
→ Create Agent
→ Refresh
→ Agent remains
```

## Chat

```text
Agent
→ New Chat
→ Send Hello
→ OpenAI response
→ Refresh
→ Both messages still visible
```

## Isolation

```text
User A
```

無法取得：

```text
User B Project/Agent/Conversation/Message
```

即使手動修改：

```text
UUID
HTTP request
browser devtools
```

也必須被 database / Edge Function 阻擋。

---

# 59. Definition of Done

Claude Code 在最後必須執行：

```bash
npm install
npm run build
```

若有：

```bash
npm run lint
```

也必須執行。

若 Supabase local 可用：

```bash
supabase db reset
```

確認 migration 可從零建立。

若 OpenAI secret 有提供：

測試：

```text
chat Edge Function
```

若 secret 未提供：

至少完成：

- Function compile
- request validation
- auth flow
- DB logic

並清楚列出尚待使用者提供：

```text
OPENAI_API_KEY
```

---

# 60. 實作順序

Claude Code 必須依下列順序執行。

## Phase 1 — Foundation

1. Inspect repository
2. 保留可用 frontend
3. 建立 Supabase client
4. 建立 `.env.example`
5. 建立 routing
6. 建立 auth state

完成後：

```bash
npm run build
```

---

## Phase 2 — Database

1. 建立 migration
2. profiles
3. projects
4. agents
5. conversations
6. messages
7. indexes
8. triggers
9. grants
10. RLS

完成後：

```bash
supabase db reset
```

---

## Phase 3 — Authentication UI

1. Register
2. Login
3. Logout
4. Protected routes

完成後：

```bash
npm run build
```

---

## Phase 4 — Project / Agent

1. Project service
2. Project pages
3. Agent service
4. Agent pages

完成後：

```bash
npm run build
```

---

## Phase 5 — Conversation

1. conversation service
2. New Chat
3. conversation list
4. message history

完成後：

```bash
npm run build
```

---

## Phase 6 — Edge Function

建立：

```text
supabase/functions/chat
```

功能：

1. CORS
2. POST validation
3. authenticate user
4. load conversation
5. ownership validation
6. load agent
7. load latest 30 messages
8. insert user message
9. call OpenAI
10. insert assistant message
11. update title
12. return response

---

## Phase 7 — Chat UI

1. textarea
2. send
3. loading
4. error
5. assistant result
6. reload history
7. double submit prevention

---

## Phase 8 — GitHub Pages

1. HashRouter
2. Vite base path
3. workflow
4. GitHub Pages artifact
5. README deployment setup

---

## Phase 9 — Security Verification

使用兩個 users 驗證：

```text
RLS
Edge Function ownership
```

不要只做 UI 測試。

---

# 61. Edge Function Pseudocode

實際程式可依當前 Supabase SDK 調整，但行為必須符合：

```ts
POST /chat

verify authenticated user

parse body
validate conversationId
validate message

load conversation under user auth context
if not found:
    404

load agent
verify:
    agent.id === conversation.agent_id
    agent.project_id === conversation.project_id

load last 30 messages

insert user message

response = OpenAI Responses API(
    model,
    system_prompt,
    history + new message
)

validate assistant text

insert assistant message

if conversation.title === "New Chat":
    update title from user message

update conversation.updated_at

return assistant message
```

---

# 62. OpenAI Responses API 原則

不要使用已過時的 completion-style 架構來新增新功能。

使用官方目前支援的 Responses API。

Edge Function 可使用：

```text
OpenAI official JS SDK
```

或直接 HTTPS API。

優先：

```text
official SDK
```

前提是可正常於 Supabase Edge Function / Deno 環境運作。

若 SDK compatibility 有問題，使用標準 `fetch()` 呼叫 Responses API。

不要因此引入獨立 Node server。

---

# 63. OpenAI Prompt 組合

Agent：

```text
system_prompt
```

做為 instruction。

Conversation history 僅包含：

```text
user
assistant
```

不要把 database metadata 直接丟給模型。

禁止傳：

```text
owner_id
email
Supabase JWT
API key
database connection string
```

---

# 64. 資料長度限制

Frontend：

```text
Project name <= 100
Agent name <= 100
description <= 1000
system_prompt <= 10000
chat message <= 20000
```

Database 仍用 text，但 Edge Function 必須驗證 chat message max length。

---

# 65. Sanitization

React 顯示 assistant content 時：

第一版使用純文字或安全 Markdown renderer。

若引入 Markdown：

禁止 raw HTML。

不要直接：

```text
dangerouslySetInnerHTML
```

渲染 LLM content。

---

# 66. Logging

Frontend：

Production 不要留下大量 debug console。

Edge Function：

允許：

```text
request started
user id
conversation id
OpenAI status
duration
error category
```

禁止 log：

```text
password
JWT
API key
完整 Authorization header
```

---

# 67. Git Ignore

確認包含：

```gitignore
.env
.env.local
.env.*.local
supabase/.env.local
node_modules/
dist/
```

`.env.example` 不忽略。

---

# 68. GitHub Pages Workflow 驗收

Workflow 必須：

```text
main push
  ↓
build
  ↓
upload artifact
  ↓
deploy pages
```

不允許：

```text
commit dist back to main
```

也不要要求 `gh-pages` branch。

使用 GitHub 官方 Pages Actions。

---

# 69. README Manual Setup Checklist

README 最後提供可勾選清單：

```text
[ ] Create Supabase project
[ ] Configure Auth
[ ] Run migrations
[ ] Set OPENAI_API_KEY
[ ] Set OPENAI_MODEL
[ ] Deploy chat Edge Function
[ ] Configure Site URL
[ ] Add GitHub Variables
[ ] Enable GitHub Pages via Actions
[ ] Push main
[ ] Register first user
[ ] Create project
[ ] Create agent
[ ] Test chat
```

---

# 70. Phase 2 預留，但本次不要做

Schema 設計請避免阻礙未來加入：

```text
knowledge_bases
knowledge_documents
knowledge_chunks
skills
agent_skills
providers
tasks
local_runners
agent_jobs
```

但：

**本次不要建立這些 table。**

避免 premature architecture。

---

# 71. 不要做的重構

若是從 Octop repository 改：

不要試圖：

- 一次移除所有 Python backend
- Rewrite 整個 UI
- Port harness-agent
- Port harness-memory
- Port plugin framework

MVP 可以建立新的 Web 路徑或逐步替換。

目標是先讓：

```text
GitHub Pages
+
Supabase
+
OpenAI
```

完整跑通。

---

# 72. 最終架構

```text
┌────────────────────────────────────┐
│ GitHub                              │
│                                    │
│ Source Repository                  │
│        │                           │
│        ▼                           │
│ GitHub Actions                     │
│        │                           │
│        ▼                           │
│ GitHub Pages                       │
│ React + TypeScript + Vite          │
└────────────────┬───────────────────┘
                 │
                 │ HTTPS
                 ▼
┌────────────────────────────────────┐
│ Supabase                           │
│                                    │
│ Auth                               │
│ PostgreSQL                         │
│ RLS                                │
│ Edge Function: chat                │
└────────────────┬───────────────────┘
                 │
                 │ Server-side
                 ▼
┌────────────────────────────────────┐
│ OpenAI Responses API               │
└────────────────────────────────────┘
```

---

# 73. 成功情境

最終使用者操作：

```text
Open GitHub Pages
        ↓
Register
        ↓
Login
        ↓
Create Project
        ↓
Create Agent
        ↓
Configure System Prompt
        ↓
New Chat
        ↓
Type Question
        ↓
Supabase Edge Function
        ↓
OpenAI
        ↓
Assistant Reply
        ↓
Postgres 保存歷史
        ↓
Refresh
        ↓
聊天仍存在
```

這條流程完整通過，即視為第一階段 MVP 核心完成。

---

# 74. Claude Code 最終任務

請現在開始依本規格執行。

不要只產出設計或 TODO。

請實際：

1. Inspect repository
2. 建立/修改 source files
3. 建立 Supabase migrations
4. 建立 RLS
5. 建立 Edge Function
6. 建立 React pages
7. 建立 service layer
8. 建立 GitHub Pages workflow
9. 更新 README
10. 執行 build / lint / migration verification
11. 修正可修正的錯誤
12. 最後提供完整執行報告

如果缺少：

```text
Supabase credentials
OpenAI API key
GitHub deployment permission
```

不要因此停止 source code 實作。

完成所有可以離線完成的部分，最後清楚列出需要使用者手動設定的項目。

---

# 75. 參考官方文件

實作時應以最新官方文件為準：

- GitHub Pages  
  https://docs.github.com/en/pages
- GitHub Pages custom workflow  
  https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Supabase Auth  
  https://supabase.com/docs/guides/auth
- Supabase Row Level Security  
  https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Edge Functions  
  https://supabase.com/docs/guides/functions
- Supabase Edge Function Auth  
  https://supabase.com/docs/guides/functions/auth
- Supabase API Keys  
  https://supabase.com/docs/guides/getting-started/api-keys
- OpenAI API  
  https://platform.openai.com/docs
- OpenAI Models  
  https://platform.openai.com/docs/models

若本文件中的 SDK 呼叫方式與官方最新文件衝突：

**以官方最新文件為準，但不得改變本文件的安全邊界與 MVP scope。**
