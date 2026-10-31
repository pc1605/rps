# Monorepo Layout

```
~/Development/rps/
├── .env                          # root env (DATABASE_URL etc.) — migrations source this
├── .npmrc                        # node-linker=hoisted
├── pnpm-workspace.yaml           # nodeLinker: hoisted, allowBuilds
├── metro.config.js               # workspace watchFolders for Expo
├── seeds/                        # 01-catalog.sql (real items/barcodes), 02-demo.sql (batches lifecycle)
├── scripts/                      # seed-dev.sh, seed-uploads.sh, review.sh
├── v2.md                         # historical backlog; mostly superseded by 08-roadmap/
├── docker-compose.yml            # PostgreSQL 16 + Adminer containers
├── apps/
│   ├── backend/
│   │   ├── RPS.postman_collection.json # Postman collection for API test automation
│   │   ├── cmd/server/main.go    # Fiber app, CORS, Guard, route registration
│   │   ├── cmd/seed/             # creates admin user (+ reference data)
│   │   ├── migrations/           # 000001 … 000011 (see 02-domain/data-model.md)
│   │   └── internal/
│   │       ├── auth/             # Guard middleware, claims, login/refresh, RequireRole
│   │       ├── audit/            # audit.Write(ctx, tx, Entry)
│   │       ├── batch/            # types.go, service.go, handler.go, routes.go — the core domain
│   │       ├── worker/           # worker CRUD, login, enrollment code
│   │       ├── reference/        # car models, brands, product lines, rolls
│   │       ├── stock/            # rolls + finished goods
│   │       ├── report/           # worker productivity
│   │       └── httpx/            # response helpers: OK, BadRequest, Forbidden, Internal, Error
│   ├── admin-web/
│   │   ├── app/(dashboard)/      # dashboard, batches, batches/[id], cars, stock, workers, reports
│   │   ├── components/layout/    # sidebar.tsx, batch-subnav.tsx
│   │   ├── components/ui/        # shadcn
│   │   ├── features/<domain>/    # types.ts, api.ts, hooks.ts, components/, (views.ts, label-pdf.ts)
│   │   └── lib/api-client.ts     # axios + single-flight 401 refresh
│   └── mobile/
│       ├── app/                  # expo-router screens (see 05-mobile/structure.md)
│       ├── components/ui/        # Screen, Card, AppButton, Banner, Chip, Skeleton, Stat
│       ├── features/auth/        # store.ts (zustand), enroll-draft.ts, api
│       ├── features/batches/     # types.ts, api.ts, hooks.ts
│       └── lib/                  # api-client.ts, theme.ts, unistyles.ts, query-provider.tsx
└── packages/shared/              # @rps/shared package (types, constants, labels)
```

## Feature-folder convention (web & mobile)
Every domain lives in `features/<domain>/` with `types.ts` (mirror of Go JSON), `api.ts` (axios calls returning
`res.data?.data ?? res.data`), `hooks.ts` (TanStack Query hooks; invalidate on mutations), and `components/`.
Admin tables are **config-driven**: a `columns: Column[]` array with `{key, header, align, width, cell}`.
