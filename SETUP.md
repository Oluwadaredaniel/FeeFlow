# FeeFlow — Setup & Installation

Monorepo: **Next.js 14 (frontend)** + **NestJS (backend)** managed with **npm workspaces**.

Run every command from the **repo root** unless told otherwise. The folder skeleton, root
`package.json` (workspaces), `.gitignore`, env templates, and shared configs are already in place.

```
feeflow/
├── apps/
│   ├── frontend/      # Next.js 14 (App Router) — created in step 2
│   └── backend/       # NestJS              — created in step 3
├── packages/          # shared code (types, etc.) — optional, later
├── supabase/
│   ├── migrations/    # paste schema from doc/Database_Schema.md here
│   └── seed/          # 200 students + 3 depts + 5 fees seed (later)
├── env/               # .env templates (copy into apps/* in step 5)
├── doc/               # specs
└── package.json       # npm workspaces root
```

---

## 0. Prerequisites (install once, globally)

```bash
node --version      # need v18+
npm --version       # need v9+
git --version       # need v2.40+

# Global CLIs
npm install -g @nestjs/cli      # NestJS scaffolder (required for step 3)
npm install -g vercel           # deploy frontend (optional now)

# Supabase CLI (pick ONE for your OS)
npm install -g supabase         # works, but npm-global is deprecated by Supabase
# macOS:    brew install supabase/tap/supabase
# Windows:  scoop install supabase   (or)  winget install Supabase.CLI
# ...or skip the global install and just use `npx supabase <cmd>`
```

---

## 1. Root dev tooling

```bash
# from repo root — installs concurrently, prettier, husky, eslint (root devDeps)
npm install

# enable git hooks (husky v9)
npx husky init
```

---

## 2. Frontend — Next.js 14

```bash
cd apps
npx create-next-app@14 frontend \
  --typescript --tailwind --app --src-dir --eslint \
  --import-alias "@/*" --use-npm

cd frontend

# Core libs (data, auth, http, motion, icons, forms)
npm install @supabase/supabase-js @supabase/ssr axios framer-motion lucide-react
npm install react-hook-form zod @hookform/resolvers date-fns

# shadcn/ui  (NOTE: package is now `shadcn`, the old `shadcn-ui` is deprecated)
npx shadcn@latest init
npx shadcn@latest add button card input form table badge dialog sonner

cd ../..
```

> The roadmap shows the folders `(auth)/login`, `(dashboard)/`, `components/`, `lib/`.
> With `--src-dir` your code lives under `apps/frontend/src/`. Create the route groups as you build.

---

## 3. Backend — NestJS

```bash
cd apps
nest new backend --package-manager npm --skip-git

cd backend

# Config, Supabase, HTTP, validation, rate limiting
npm install @nestjs/config @supabase/supabase-js axios
npm install class-validator class-transformer @nestjs/throttler

# Structured logging
npm install nestjs-pino pino pino-http
npm install -D pino-pretty

# (add later, when you build those features)
# npm install @sendgrid/mail        # receipt emails
# npm install pdfkit                 # receipt PDFs
# npm install node-cron             # missed-webhook reconciliation job

cd ../..
```

NestJS defaults its dev script to `start:dev`. Add a `dev` alias so the root `npm run dev` works —
in **apps/backend/package.json** `scripts`, add:

```json
"dev": "nest start --watch"
```

By default NestJS runs on port 3000 (same as Next.js). In **apps/backend/src/main.ts** set:

```ts
await app.listen(process.env.PORT ?? 3001);
```

---

## 4. Re-link workspaces

After both apps exist, run once more at the **repo root** so npm hoists/links everything:

```bash
npm install
```

---

## 5. Environment variables

```bash
# from repo root — copy templates into each app (these targets are gitignored)
cp env/frontend.env.local.example apps/frontend/.env.local
cp env/backend.env.example        apps/backend/.env
```

Then fill in real values:

- **Supabase** URL + anon key + service-role key → Supabase dashboard → Project Settings → API
- **Nomba** TEST credentials → see `CLAUDE.md` (use TEST for build week, switch to LIVE on submission day)
- **JWT_SECRET** → generate one:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
  ```
- **SendGrid** API key → SendGrid dashboard

---

## 6. Database (Supabase)

1. Create a project at https://app.supabase.com
2. Save the schema: paste the SQL from `doc/Database_Schema.md` into `supabase/migrations/0001_init.sql`
3. Apply it — either:
   - **SQL Editor:** paste and run in the Supabase dashboard, **or**
   - **CLI:**
     ```bash
     supabase link --project-ref <your-project-ref>
     supabase db push
     ```
4. Verify tables:
   ```sql
   select table_name from information_schema.tables
   where table_schema = 'public' order by table_name;
   ```

---

## 7. Run it

```bash
# from repo root — both apps together
npm run dev

# or individually
npm run dev:frontend   # http://localhost:3000
npm run dev:backend    # http://localhost:3001  (health check: /health once you add it)
```

---

## One-shot (copy/paste everything)

```bash
# globals
npm install -g @nestjs/cli vercel

# root
npm install && npx husky init

# frontend
cd apps && npx create-next-app@14 frontend --typescript --tailwind --app --src-dir --eslint --import-alias "@/*" --use-npm
cd frontend && npm install @supabase/supabase-js @supabase/ssr axios framer-motion lucide-react react-hook-form zod @hookform/resolvers date-fns && npx shadcn@latest init && npx shadcn@latest add button card input form table badge dialog sonner
cd ../..

# backend
cd apps && nest new backend --package-manager npm --skip-git
cd backend && npm install @nestjs/config @supabase/supabase-js axios class-validator class-transformer @nestjs/throttler nestjs-pino pino pino-http && npm install -D pino-pretty
cd ../..

# re-link + env
npm install
cp env/frontend.env.local.example apps/frontend/.env.local
cp env/backend.env.example apps/backend/.env
```
