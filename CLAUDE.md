# Inviton Hackaton

## Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express + TypeScript + Node.js
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM

## Project Structure

```
/
├── client/          # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/   # API client functions
│   │   ├── types/
│   │   └── App.tsx
│   ├── tsconfig.json
│   └── package.json
├── server/          # Express backend
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts    # Drizzle table definitions
│   │   │   ├── index.ts     # DB connection + drizzle instance
│   │   │   └── migrate.ts   # Migration runner script
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── types/
│   │   └── index.ts
│   ├── drizzle.config.ts
│   ├── tsconfig.json
│   └── package.json
└── CLAUDE.md
```

## Commands

### Client (`client/`)

```bash
npm run dev          # Start Vite dev server (default: port 5173)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
```

### Server (`server/`)

```bash
npm run dev          # Start with ts-node + nodemon (default: port 3001)
npm run build        # Compile TypeScript
npm run start        # Run compiled JS
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
```

### Database

```bash
cd server
npx drizzle-kit generate    # Generate migration from schema changes
npx drizzle-kit migrate     # Apply pending migrations
npx drizzle-kit push        # Push schema directly (dev only, no migration file)
npx drizzle-kit studio      # Open Drizzle Studio GUI
npx tsx src/db/seed.ts       # Run seed script
```

## Code Conventions

- Use functional components with hooks (no class components)
- Use `async/await` over raw promises
- Use named exports (no default exports)
- API routes: RESTful, prefixed with `/api/` (e.g., `/api/users`)
- Keep controllers thin — business logic goes in `server/src/services/`
- Frontend API calls go in `client/src/services/` (one file per resource)
- Use Drizzle schema types (`$inferSelect`, `$inferInsert`) as the source of truth — don't duplicate DB types manually
- Shared types between client/server go in route response/request shapes defined in server controllers

## Environment Variables

Server expects a `.env` file in `server/`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/inviton
PORT=3001
```

Client expects a `.env` file in `client/` (Vite convention):

```
VITE_API_URL=http://localhost:3001/api
```

Never commit `.env` files.

## Error Handling

- Backend: use a centralized error-handling middleware in `server/src/middleware/errorHandler.ts`
- Throw typed errors (extend `Error` with a `statusCode` property)
- Frontend: handle API errors in service functions, surface via component state

## Database

- Define tables in `server/src/db/schema.ts` using Drizzle's `pgTable` helpers
- Generate migrations after schema changes (`drizzle-kit generate`)
- Never edit migration files after they've been applied
- Drizzle config lives in `server/drizzle.config.ts`
- Seed data goes in `server/src/db/seed.ts`
