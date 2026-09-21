# Octop Web

Projects, agents and chat, built as a pure web application: a static React
bundle on GitHub Pages talking to Supabase, with a single Edge Function as the
only path to OpenAI.

---

## 1. Architecture

```text
┌────────────────────────────────────┐
│ GitHub                             │
│   Source repository                │
│        ↓                           │
│   GitHub Actions                   │
│        ↓                           │
│   GitHub Pages                     │
│   React + TypeScript + Vite        │
└────────────────┬───────────────────┘
                 │ HTTPS
                 ▼
┌────────────────────────────────────┐
│ Supabase                           │
│   Auth (email + password)          │
│   PostgreSQL                       │
│   Row Level Security               │
│   Edge Function: chat              │
└────────────────┬───────────────────┘
                 │ server side only
                 ▼
┌────────────────────────────────────┐
│ OpenAI Responses API               │
└────────────────────────────────────┘
```

There is no application server. The browser holds only publishable
configuration; every access decision is made by Postgres RLS, and the OpenAI
key never leaves the Edge Function environment.

**Data model**

| Table           | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `profiles`      | Mirrors `auth.users`, created by trigger            |
| `projects`      | Top-level container, owned by one user              |
| `agents`        | System prompt plus optional model, inside a project |
| `conversations` | A chat thread against one agent                     |
| `messages`      | `user` / `assistant` turns, append-only             |

---

## 2. Prerequisites

- Node.js 20 or newer (CI uses 22)
- npm
- A Supabase account and project
- An OpenAI API key
- Supabase CLI, for migrations and function deploys:
  `npm i -g supabase` or run it through `npx supabase`
- Docker Desktop, only if you want to run Supabase locally

---

## 3. Supabase project setup

1. Create a project at <https://supabase.com/dashboard>.
2. Note the project reference (the `abcd…` part of the project URL).
3. Copy **Project URL** and the **publishable** (anon) key from
   **Project Settings → API keys**.

The publishable key is designed to ship in a browser bundle. It grants nothing
on its own — the `anon` role has no privileges on any application table (see
the `revoke` statements in the migration), and every table has RLS enabled.

Never copy the **secret** / **service role** key into this project.

---

## 4. Environment variables

### Frontend (browser bundle)

Only these two may ever appear in the bundle:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Copy `.env.example` to `.env` for local development. `.env` is gitignored.

If either is missing the app renders a setup screen naming the missing
variable, rather than a blank page.

### Edge Function (server side)

| Secret            | Required | Purpose                                     |
| ----------------- | -------- | ------------------------------------------- |
| `OPENAI_API_KEY`  | yes      | Authenticates the Responses API call        |
| `OPENAI_MODEL`    | no       | Default model; falls back to `gpt-5.6-luna` |
| `ALLOWED_ORIGINS` | no       | Comma-separated CORS allow list             |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected by the platform.

---

## 5. Local development

```bash
npm install
npm run dev
```

The dev server runs at <http://localhost:5173>.

Other scripts:

```bash
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run typecheck  # tsc -b
npm run preview    # serve the production build
```

### Running Supabase locally (optional, needs Docker)

```bash
npx supabase start
npx supabase db reset          # rebuilds the database from migrations
npx supabase functions serve chat
```

For a local function run, put the OpenAI key in `supabase/.env.local` — which
is gitignored — and pass it in:

```bash
npx supabase functions serve chat --env-file supabase/.env.local
```

```env
# supabase/.env.local  (never commit this file)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-luna
ALLOWED_ORIGINS=http://localhost:5173
```

---

## 6. Database migration

Against the hosted project:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or paste `supabase/migrations/20260921000000_initial_schema.sql` into the
dashboard SQL editor. The file is written to run against an empty database in
one pass: tables, indexes, `updated_at` triggers, the `auth.users` → `profiles`
trigger, grants and RLS policies.

---

## 7. Edge Function deployment

The GitHub Actions workflow deploys the frontend only. Deploy the function from
your machine:

```bash
npx supabase functions deploy chat --project-ref <your-project-ref>
```

This keeps cross-platform deployment credentials out of CI for the first
version.

---

## 8. Supabase secrets

```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set OPENAI_MODEL=gpt-5.6-luna
npx supabase secrets set ALLOWED_ORIGINS=http://localhost:5173,https://<user>.github.io
```

These values belong in Supabase only. Do not put them in Git, in a migration,
in TypeScript source, in this README, or in GitHub Pages variables.

`ALLOWED_ORIGINS` is an origin list — scheme, host and port. A project page
path such as `/octop-web/` is not part of the origin, so
`https://<user>.github.io` is the correct entry.

---

## 9. GitHub Pages setup

1. **Settings → Pages → Build and deployment → Source**: choose
   **GitHub Actions**.
2. Add the repository variables below.
3. Push to `main`, or run **Deploy to GitHub Pages** from the Actions tab.

The workflow builds the bundle and publishes it through the official Pages
actions. It never commits `dist` back to the repository and does not use a
`gh-pages` branch.

### Base path

`vite.config.ts` resolves the base path in this order:

1. `VITE_BASE_PATH` if set
2. `/<repo-name>/`, derived from `GITHUB_REPOSITORY` inside Actions
3. `/` for local development and `<user>.github.io` repositories

A fork therefore needs no source edit. Set the `VITE_BASE_PATH` variable only
for something unusual, such as a custom domain served from the root.

---

## 10. GitHub repository variables

**Settings → Secrets and variables → Actions → Variables**:

| Variable                        | Value                            |
| ------------------------------- | -------------------------------- |
| `VITE_SUPABASE_URL`             | `https://<ref>.supabase.co`      |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your publishable / anon key      |
| `VITE_BASE_PATH`                | optional, only to override       |

Variables rather than Secrets is deliberate: both values are publishable
browser configuration, not server credentials, and masking them in logs would
suggest a protection they do not have. The workflow also reads the same names
from `secrets` if you prefer to store them there.

---

## 11. Authentication URL configuration

In the Supabase dashboard under **Authentication → URL Configuration**:

- **Site URL**: `https://<user>.github.io/<repo>/`
- **Redirect URLs**: add both
  - `https://<user>.github.io/<repo>/`
  - `http://localhost:5173`

The MVP uses email and password, so there is no OAuth callback, but sign-up
confirmation links are built from the Site URL.

If you would rather not confirm email addresses while testing, turn off
**Confirm email** under **Authentication → Sign In / Providers → Email**.

---

## 12. Security notes

- The browser bundle carries exactly two variables: `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY`. No OpenAI key, no service role key.
- Every application table has RLS enabled, **and** the `anon` role has all
  privileges revoked. Grants and policies are treated as separate layers.
- The Edge Function never uses a service role key. It builds a Supabase client
  from the caller's own `Authorization` header, so RLS applies to every
  statement it runs.
- User identity comes only from the verified JWT. The request body is never
  trusted to say who the caller is.
- Before answering, the function checks that the conversation, its agent and
  its project all belong to the caller, and that the agent really lives in that
  project. The schema backs the last point with a composite foreign key.
- The client cannot choose a model. The model comes from `agents.model` — which
  only the owner can write — or from the server default.
- The browser never inserts the user message. The function writes both turns, so
  the flow cannot be half-completed or bypassed.
- Model output is rendered as escaped plain text. There is no Markdown parser
  and no `dangerouslySetInnerHTML`.
- Error responses are generic. Function logs record request id, user id,
  conversation id, status and duration — never keys, tokens or passwords.

---

## 13. Production limitations

- **Production phase should add server-side per-user rate limiting.** The MVP
  only disables the Send button while a request is in flight, which stops
  double submits but not a determined client.
- Replies are not streamed. One request, one complete response.
- Context is capped at the most recent 30 messages, with no summarisation, so
  long conversations lose their earliest turns.
- A project has an owner and no other members.
- `ALLOWED_ORIGINS` should be set explicitly in production; the built-in
  fallback only covers localhost.

---

## 14. MVP scope

Email/password register, login, logout and persisted sessions · project CRUD ·
agent CRUD · conversation create, list and delete · chat with OpenAI through
the Edge Function · stored history that survives a refresh · RLS on every table
· automatic GitHub Pages deployment · loading and error states throughout ·
responsive layout down to phone width.

## 15. Out of scope

RAG · pgvector · knowledge bases · Storage · file upload · local runner ·
Codex CLI · Claude Code runner · MCP · skills · plugins · cron · browser
automation · terminal · remote desktop · multi-agent orchestration · agent
teams · Supabase Realtime · IM channels (Discord, Telegram, Line, WeCom,
DingTalk, Feishu) · GitHub/Google OAuth · SSO · billing · token accounting ·
organizations and teams · admin console · streaming responses.

---

## 16. Manual setup checklist

```text
[ ] Create Supabase project
[ ] Configure Auth (Site URL + redirect URLs)
[ ] Run migrations
[ ] Set OPENAI_API_KEY
[ ] Set OPENAI_MODEL
[ ] Set ALLOWED_ORIGINS
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
