# Monorepo Layout

```
~/Development/rps/
├── .env                          # root env (DATABASE_URL etc.) — migrations source this
├── .npmrc                        # node-linker=hoisted
├── pnpm-workspace.yaml           # nodeLinker: hoisted, allowBuilds
├── metro.config.js               # workspace watchFolders for Expo
├── demo-seed.sql                 # OLD demo data (pre-multi-worker) — do not run; needs rewrite (see roadmap)
├── v2.md                         # historical backlog; mostly superseded by 08-roadmap/
├── rps.postman_collection.json   # Postman collection (see 06-operations/testing.md)  **VERIFY filename**
├── apps/
│   ├── backend/
│   │   ├── cmd/server/main.go    # Fiber app, CORS, Guard, route registration
│   │   ├── cmd/seed/             # creates admin user (+ reference data)
│   │   ├── migrations/           # 000001 … 000007 (see 02-domain/data-model.md)
│   │   └── internal/
│   │       ├── auth/             # Guard middleware, claims, login/refresh, RequireRole
│   │       ├── audit/            # audit.Write(ctx, tx, Entry)
│   │       ├── batch/            # types.go, service.go, handler.go, routes.go — the core domain
│   │       ├── worker/           # worker CRUD, login, enrollment code
│   │       ├── reference/        # car models, rolls (read)
│   │       ├── stock/            # rolls + finished goods
│   │       ├── report/           # worker productivity
│   │       └── httpx/            # response helpers: OK, BadRequest, Forbidden, Internal, Error
│   ├── admin-web/
│   │   ├── app/(dashboard)/      # dashboard, batches, batches/[id], stock, workers, reports
│   │   ├── components/layout/    # sidebar.tsx, batch-subnav.tsx
│   │   ├── components/ui/        # shadcn
│   │   ├── features/<domain>/    # types.ts, api.ts, hooks.ts, components/, (views.ts, label-pdf.ts)
│   │   └── lib/api-client.ts     # axios + single-flight 401 refresh
│   └── mobile/
│       ├── app/                  # expo-router screens (see 05-mobile/structure.md)
│       ├── components/ui/        # Screen, Card, AppButton
│       ├── features/auth/        # store.ts (zustand), enroll-draft.ts, api
│       ├── features/batches/     # types.ts, api.ts, hooks.ts
│       └── lib/                  # api-client.ts, theme.ts, unistyles.ts, query-provider.tsx
└── (planned) packages/shared     # shared TS types — overdue; types are currently duplicated 3× (Go/web/mobile)
```

## Feature-folder convention (web & mobile)
Every domain lives in `features/<domain>/` with `types.ts` (mirror of Go JSON), `api.ts` (axios calls returning
`res.data?.data ?? res.data`), `hooks.ts` (TanStack Query hooks; invalidate on mutations), and `components/`.
Admin tables are **config-driven**: a `columns: Column[]` array with `{key, header, align, width, cell}`.
