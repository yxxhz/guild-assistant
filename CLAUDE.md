# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Node.js path (required — not in default PATH on this machine)
PATH="/c/Users/99122/node-v22.14.0-win-x64:$PATH"

# Dev server (Turbopack)
npx next dev --turbopack

# Build
npx next build

# Prisma: push schema changes and regenerate client (run from project root)
cd /c/Users/99122/Desktop/项目/guild-assistant
npx prisma db push
npx prisma generate

# Prisma studio (DB browser)
npx prisma studio
```

## Environment

- **Node.js**: v22.14.0 at `/c/Users/99122/node-v22.14.0-win-x64`
- **Platform**: Windows 11 (bash via git-bash)
- **Kill processes**: `powershell -Command "Stop-Process -Id <PID> -Force"` (not `kill -9`)
- **Required .env**: `DEEPSEEK_API_KEY`, `DATABASE_URL=file:./dev.db`, `JWT_SECRET`

## Tech Stack

- **Next.js 16.2.4** (App Router) — uses `proxy.ts` (formerly `middleware.ts`) with `proxy()` function for auth redirects
- **Turbopack** for dev — `next.config.ts` is minimal
- **Prisma 7.8.0** with SQLite via `@prisma/adapter-libsql` — `prisma-client` generator with explicit `output: "../src/generated"`, `prisma.config.ts` for CLI config
- **Tailwind CSS 4** — uses `@theme inline` in CSS, no `tailwind.config.ts`
- **Auth**: JWT with httpOnly cookie (`session`), 7-day expiry, `next/headers` → `cookies()` (async)
- **AI**: DeepSeek API (OpenAI-compatible SDK) for FAQ matching and tone polishing
- **DB path**: root `dev.db` (data), prisma `prisma/dev.db` (empty)

## Architecture

```
src/
├── app/
│   ├── api/                 # REST API routes
│   │   ├── auth/            # login, logout, register, me
│   │   ├── chat/suggestions # FAQ matching entry point
│   │   ├── conversations/   # CRUD + message + streamer linking
│   │   ├── faq/             # KnowledgeBase CRUD + import
│   │   ├── feedback/        # Suggestion feedback
│   │   ├── generate/        # DeepSeek content generation
│   │   ├── polish/          # Tone polishing
│   │   ├── setup/           # First-run setup
│   │   └── streamers/       # CRUD + [id] (role-filtered)
│   ├── chat/                # Main chat page (suggestions + streamer info)
│   ├── faq/                 # FAQ management page
│   ├── streamers/           # Streamer management page
│   ├── login/               # Login page
│   ├── register/            # Register page
│   └── layout.tsx           # Root layout: AuthProvider + TopNav
├── components/
│   ├── TopNav.tsx           # Global top navigation bar
│   └── StreamerInfo.tsx     # Right panel: streamer info form + linking
├── lib/
│   ├── auth.ts              # JWT helpers, password hashing
│   ├── auth-context.tsx      # React context for auth
│   ├── deepseek.ts          # FAQ matching + tone polishing + content gen
│   └── prisma.ts            # Prisma client (libSQL adapter singleton)
├── proxy.ts                 # Auth redirect middleware (Next.js 16 proxy)
└── generated/               # Prisma client output (gitignored)
```

## Key Features

1. **Chat + Suggestions**: User pastes streamer message → `matchFAQ()` finds top 3 FAQ matches via multi-level fuzzy keyword matching → shows A/B/C cards with tone polish preview
2. **Tone Polishing**: DeepSeek API rewrites suggestions in 5 tones (natural/lively/cute/professional/gentle)
3. **Streamer Profiles**: CRUD with multi-image upload (data URLs), resume files, bio text; role-based (broker sees own, admin sees all)
4. **Streamer Linking**: Conversations link to streamer profiles; merge logic: conversation fields keep values, empty fields fill from profile; changes sync both ways
5. **FAQ Knowledge Base**: Multi-category, keyword-tagged, weight-based growth flywheel; import from CSV/XLSX

## Key Patterns

- **API routes**: Always check `getSession()` first (returns `JwtPayload | null`), return 401 if null. Role checks: fetch user, compare `user.role !== "admin"`.
- **Streamer info merge** (conversations/streamer/route.ts): New values overwrite old, empty values don't overwrite non-empty. When linking streamerId, profile fields fill blanks at lower priority.
- **FAQ matching** (deepseek.ts `matchFAQ()`): keyword-to-keyword fuzzy match via `matchKeywordToInput()` — exact substring (1.0) → short char presence (0.8) → bigram overlap. Weight bonus: `log2(1 + weight) * 0.1`.
- **Prisma with libSQL**: Client instantiated with adapter, singleton pattern. Query methods differ slightly from standard Prisma — test DB queries manually.

## Database Models

- **User**: username, password (bcrypt), role (broker/operator/admin)
- **Streamer**: name, age, phone, address, photo, photos (JSON array), resume (JSON: {name,data}), bio, stage; belongs to User
- **Conversation**: title, userId, streamerId (nullable), streamerInfo (JSON snapshot)
- **Message**: conversationId, role, content; has Suggestions
- **KnowledgeBase**: question, answer, category, keywords, usageCount, weight
- **Suggestion**: messageId, content, label (A/B/C); has optional SuggestionFeedback
- **SuggestionFeedback**: suggestionId, userId, action (selected/rejected/refresh)
- **InteractionLog**: type, input, output, metadata (JSON)
