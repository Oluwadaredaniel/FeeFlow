# FeeFlow: Automated Fee Reconciliation Infrastructure

**Status:** Nomba Hackathon 2026 (Build Track: Virtual Accounts as Infrastructure)  
**Team:** Emerald (Full-stack), Frontend Dev, Backend Dev  
**Timeline:** June 27 - July 7, 2026 (7-day build sprint)  
**Submission:** July 7, 11:59 PM WAT  
**Demo Day:** July 19, 2026

---

## Quick Summary

FeeFlow is API-first fee reconciliation infrastructure for Nigerian educational institutions. Every student gets a dedicated virtual account (powered by Nomba). When a payment arrives, the system automatically identifies the student, reconciles fees, and calculates clearance eligibility—no manual verification required.

**Problem:** Manual fee collection is chaos. Students send screenshots, treasurers manually verify, disputes happen, balances are wrong.

**Solution:** Automated reconciliation via virtual accounts. Payment arrives → student identified → fees reconciled → clearance calculated.

**Why It Wins:** Other teams build payment portals. We build reusable payment infrastructure. Judges score on reconciliation accuracy and API quality—not UI polish.

---

## Project Name: FeeFlow

### Name Decision

**Original Name:** CampusPay  
**Problem:** Doesn't scale beyond campus. Sounds like a one-off portal, not infrastructure.

**Chosen Name:** FeeFlow

**Why FeeFlow Works:**
- ✅ Institution-agnostic (schools, universities, faculties, departments)
- ✅ Describes core function (flow of fees, reconciliation flow)
- ✅ SaaS-friendly (sounds like a B2B tool you pay monthly for)
- ✅ Memorable and slightly premium
- ✅ Domain available: feeflow.io
- ✅ Scales with brand (FeeFlow for HQ, FeeFlow for OAU, etc.)

**Competitors/Alternatives Considered:**
- RectifyPay (emphasizes reconciliation, too made-up)
- Collecter (could work, typo risk)
- SchoolBox Payments (too specific to schools)
- Tuition.io (too tuition-specific)
- Fintrack (too generic)

**Build Plan:** Use FeeFlow as primary name. Code is institution-agnostic so rebranding is just logo + landing page, not deep refactoring.

---

## What We're Shipping (Hackathon Submission)

### Core MVP (7-Day Build)

**Must Have:**
1. Multi-tenant institution accounts (admin creates account, gets dashboard)
2. Student management (create, import, view, each gets unique virtual account)
3. Fee templates (admin creates fee types with fixed amounts)
4. Automatic reconciliation (payment arrives → webhook → student identified → fee marked paid)
5. Clearance calculation (hardcoded logic: if all required fees paid → CLEARED)
6. Student dashboard (view fees, pay status, clearance status, receipts)
7. Admin dashboard (revenue collected, students owing, transaction log)
8. Nomba virtual account integration (create accounts, listen to webhooks, query balances)
9. Receipt generation (email PDF after payment)
10. Working API with documentation

**Will NOT Build (Phase 2):**
- Configurable rules engine (installments, penalties, dunning)
- Overpayment refund workflows (basic logic: keep as credit, flag for admin)
- Faculty/Department hierarchy (one institution = flat org)
- Student transfer flows
- Duplicate payment detection (manual flag instead)
- Advanced reporting (CSV export only)
- Mobile app
- Offline support

**Simulating for Demo:**
- Real OAU data? No. Seed data: 200 students + 3 departments + 5 fees
- Real institution onboarding? Hardcode OAU for build week. Add multi-institution after.
- Real email? Yes, SendGrid. Real SMS? Only if time.

---

## Tech Stack (Quick Reference)

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14 (App Router) | Speed, full-stack, SSR, API routes |
| Backend | Next.js API Routes + NestJS (if needed) | Fast iteration, structured if complexity demands it |
| Database | Supabase (PostgreSQL) | ACID transactions for payments, multi-tenancy RLS |
| Auth | Supabase Auth | Email/OTP, JWT, no vendor lock-in |
| Payments | Nomba APIs | Virtual accounts, settlements, webhooks (you have credentials) |
| Storage | Supabase Storage + S3 (optional) | Receipts, documents |
| Email | SendGrid | Receipts, notifications |
| SMS (Optional) | Twilio | OTP, payment alerts |
| Jobs/Queue | node-cron (MVP) → Bull (later) | Async tasks, reconciliation retries |
| Deployment | Vercel (frontend) + Railway (backend) | Speed, cold starts acceptable for hackathon |

**Why NOT MongoDB:** Financial systems need ACID transactions. MongoDB's eventual consistency causes reconciliation bugs when payments arrive concurrently. PostgreSQL (Supabase) guarantees atomicity.

**Why NOT Firebase:** Weak for relational data and complex financial logic. Supabase gives you PostgreSQL power + Firebase-like simplicity.

---

## Nomba Credentials (Provided)

```
Account Setup:
- Parent Account ID: f666ef9b-888e-4799-85ce-acb505b28023
- Sub-Account ID: f23a4cd9-4d9b-4429-92f4-6f881d9c39b2

TEST Credentials (Use these for build week):
- Client ID: 706df6c4-b8bb-4130-88c4-d21b052f8631
- Private Key: k8UobYk3APgOoxUnNL7VpuxzwTsH4LsXtydfjcHs8RH0YISBB4OMqJsaafG+U8fWETu9YZ96bNXE+DelCDuMPw==

LIVE Credentials (Switch for submission day):
- Client ID: e5e85b13-f560-4643-814e-c87435dbbc15
- Private Key: 8/doS7Q3w77EANpk3vpgSrc05hhOiRWp3eBs01sXyZ1AmovtZUXlmrxie+xnEF2tR4q79t0IFufMD1d4JrkT8g==

Documentation: https://developer.nomba.com
Webhook Form: https://forms.gle/hKfBRHZiTGvU7LC59
```

**ACTION:** You must submit your webhook URL and sub-account ID to Nomba via the form above so they forward payment notifications to your app.

---

## Project Goals (Judging Criteria)

**Primary Focus:** Virtual Accounts as Infrastructure (from hackathon spec)

**Judged On:**
1. **Reconciliation Accuracy** ← Most important. Payment arrives, fees update correctly, balances reconcile perfectly.
2. **Identity Model Quality** ← Student ↔ Virtual Account mapping is solid, handles edge cases, no confusion.
3. **Developer API Quality** ← Other teams should be able to integrate your APIs into their own systems.

**Secondary Wins:**
- Handles underpayment, overpayment, misdirected payments
- Produces receipts automatically
- Multi-tenant design
- Production-ready error handling

**NOT Judged On:**
- UI aesthetics (judges care about architecture)
- All user roles (hardcode admin panel)
- Complete fee configurability (2-3 fee types are enough)
- Perfect refund workflows (flag edge cases in docs)

---

## Why FeeFlow Wins

| Attribute | FeeFlow Advantage |
|-----------|------------------|
| **Not a Portal** | Other teams build fee payment websites. We build reusable infrastructure. |
| **Reconciliation Focus** | Every decision optimizes for accuracy: ACID transactions, deduplication, audit trails. |
| **Real Problem** | Manual fee collection is a genuine pain in 500+ Nigerian institutions. |
| **Multi-Tenant Design** | Works for universities, secondary schools, departments, student associations. |
| **API-First** | Other institutions can integrate our APIs into their own systems. |
| **Edge Cases** | We handle underpayment, overpayment, misdirected payments, webhook failures, orphaned funds. |
| **Production-Ready** | Handles Nomba webhook retries, network outages, concurrent payments, race conditions. |

---

## Quick Start: Getting Everyone Onboarded

### Prerequisites

```bash
# Install globally (all team members)
node --version          # v18+
npm --version           # v9+
git --version           # v2.40+

# Install per machine
npm install -g vercel   # Deploy frontend
npm install -g railway  # Deploy backend (optional, use CLI)
```

### Repository Setup

```bash
# Create monorepo (single git repo for both frontend & backend)
mkdir feeflow
cd feeflow
git init

# Directory structure
mkdir -p apps/frontend apps/backend
mkdir -p docs
touch .gitignore README.md

# Frontend
cd apps/frontend
npx create-next-app@latest . --typescript --tailwind --app
npm install shadcn-ui framer-motion axios @supabase/supabase-js

# Backend (if using NestJS, otherwise use Next.js API routes)
cd ../backend
npm init -y
npm install @nestjs/core @nestjs/common express @nestjs/platform-express
npm install @supabase/supabase-js axios dotenv pino winston

# Root setup
cd ../..
npm install -D prettier eslint husky
```

### Environment Variables

**Frontend (.env.local):**
```
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[key]
NEXT_PUBLIC_API_URL=http://localhost:3001 # dev
```

**Backend (.env):**
```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_KEY=[key]
NOMBA_CLIENT_ID_TEST=706df6c4-b8bb-4130-88c4-d21b052f8631
NOMBA_PRIVATE_KEY_TEST=k8UobYk3APgOoxUnNL7VpuxzwTsH4LsXtydfjcHs8RH0YISBB4OMqJsaafG+U8fWETu9YZ96bNXE+DelCDuMPw==
SENDGRID_API_KEY=[key]
JWT_SECRET=your-super-secret-key
WEBHOOK_SECRET=nomba-webhook-signing-secret
PORT=3001
```

### Git Workflow

```bash
# Main branches
- main              # Production (submission day)
- develop           # Integration branch (all work merges here)
- feature/[name]    # Individual features

# Team naming conventions
- Emerald: feature/emerald/*
- Frontend Dev: feature/frontend/*
- Backend Dev: feature/backend/*

# Daily workflow
git checkout develop
git pull origin develop
git checkout -b feature/[your-name]/[feature-name]
# ... make changes ...
git add .
git commit -m "feat: [short description]"
git push origin feature/[your-name]/[feature-name]
# Create PR on GitHub, request review before merging
```

### Communication Channels

- **Slack:** Share links, quick questions
- **GitHub Issues:** Tasks, bugs, blockers
- **GitHub Projects:** Kanban board (To Do, In Progress, Done)
- **Daily Standups:** 30 min each morning (9 AM WAT?)

**Blockers:** If stuck >30 min, ping Emerald immediately. Don't debug alone.

---

## Day-by-Day Overview (Detailed Schedule in ROADMAP.md)

| Day | Focus | Emerald | Frontend Dev | Backend Dev |
|-----|-------|---------|--------------|-------------|
| **27 Jun** | Planning + Setup | DB schema + API design | Next.js skeleton | NestJS skeleton |
| **28 Jun** | Auth | Supabase Auth | Login UI | Auth endpoints |
| **29 Jun** | Students | Supabase + Nomba | Student UI | Student API |
| **1 Jul** | Fees + Webhooks | Payment service | Fee UI | Webhook handler |
| **2 Jul** | Clearance | Clearance logic | Dashboard | Clearance API |
| **3 Jul** | Reports + Polish | Admin service | Reports UI | API docs |
| **4-7 Jul** | Testing + Demo | End-to-end testing | UI polish | Edge case testing |

**Detailed day-by-day tasks, dependencies, and handoffs in ROADMAP.md.**

---

## Documentation Structure

1. **CLAUDE.md** (this file) - Overview, quick start, team onboarding
2. **PRODUCT_SPEC.md** - What we're building, features, user roles, lifecycle
3. **ARCHITECTURE.md** - Tech decisions, why each choice, trade-offs
4. **DATABASE_SCHEMA.md** - Every table, column, index, constraint, why
5. **API_SPEC.md** - Every endpoint, request/response, status codes, errors
6. **RECONCILIATION_FLOW.md** - Webhook flow, payment allocation, edge case handling
7. **ROADMAP.md** - 7-day task breakdown, who does what, dependencies
8. **EDGE_CASES.md** - 15+ scenarios (overpayment, misdirected, etc.) + solutions
9. **DEPLOYMENT.md** - Environment setup, CI/CD, how to go live

**Read in order:** CLAUDE → PRODUCT_SPEC → ARCHITECTURE → DATABASE_SCHEMA, then pick your role's doc.

---

## Success Criteria (How We Know We Won)

**By Demo Day (July 19):**
- ✅ FeeFlow deployed and live at feeflow.vercel.app
- ✅ API documented and accessible to judges
- ✅ Live demo: Create institution → Import students → Receive payment → Reconcile → Calculate clearance
- ✅ All edge cases tested (underpayment, overpayment, misdirected payment)
- ✅ Webhook integration working (payment arrives, system updates in real-time)
- ✅ Receipts generated and emailed
- ✅ Admin dashboard showing metrics (revenue, debtors, clearance status)
- ✅ Code passes security review (webhook signature validation, RLS policies)

**Submission Checklist in DEPLOYMENT.md (full details).**

---

## Landing Page Strategy

**Goal:** Explain to judges why FeeFlow is infrastructure, not a portal.

**Sections:**
1. **Hero:** "Stop Manually Reconciling Student Fees" + demo video
2. **Problem:** Manual fee collection creates disputes, delays, missing records
3. **Solution:** Virtual accounts + automatic reconciliation
4. **How It Works:** 3-step flow (pay → auto-match → clearance)
5. **Features:** Reconciliation accuracy, edge case handling, API-first
6. **Why It Wins:** Judges score on reconciliation, identity model, API quality
7. **Tech Stack:** Next.js, Supabase, Nomba APIs
8. **CTA:** "See Live Demo" + "View Pitch Deck"

**Design:** Dark theme (premium fintech), animated hero, Framer Motion micro-interactions, case study (OAU numbers).

**Estimated:** 4-6 hours to build after core functionality is done.

---

## Common Gotchas (Learn From These)

1. **Forgot to register webhook URL with Nomba:** You won't receive any payments. Do this immediately after backend is deployed.

2. **RLS policies too strict:** Team members can't see their own org's data. Test RLS early, iterate daily.

3. **Race condition on concurrent payments:** Two payments to same student hit simultaneously. Use `SELECT ... FOR UPDATE` to lock rows atomically.

4. **Nomba API authentication:** Wrong account ID or signature causes all API calls to fail silently. Log every call, compare against Nomba docs.

5. **Supabase connection pool exhaustion:** Too many open connections from API server. Use connection pooling (Supabase PgBouncer mode).

6. **Email not arriving:** SendGrid marked as spam. Test with personal email first, check spam folder.

7. **Webhook signature mismatch:** Nomba signs webhook with HMAC-SHA256. If validation fails, you reject legitimate payments. Double-check secret key format.

8. **Student virtual account not created:** Nomba API call succeeded but returned null. Always check response, add retry logic with exponential backoff.

9. **TypeScript errors in Next.js:** Strict mode catches bugs but slows dev. Use `skipLibCheck: true` in tsconfig.json, but fix actual bugs.

10. **Vercel/Railway cold starts:** First request after deploy takes 10+ seconds. Acceptable for hackathon, but document it for judges.

---

## Support & Escalation

**Blocker on Task?**
1. Search EDGE_CASES.md (might be documented)
2. Check Nomba API docs (https://developer.nomba.com)
3. Post in Slack (team can help)
4. Ping Emerald directly (if >30 min stuck)

**API Question?** → Check API_SPEC.md  
**Database Question?** → Check DATABASE_SCHEMA.md  
**Reconciliation Logic Question?** → Check RECONCILIATION_FLOW.md  
**Edge Case Question?** → Check EDGE_CASES.md  

**Nomba Integration Question?** → Nomba Slack channel + developer docs

---

## Key Contacts & Resources

**Nomba:**
- API Docs: https://developer.nomba.com
- Webhook Form: https://forms.gle/hKfBRHZiTGvU7LC59
- Nomba Hackathon Slack Channel (check email for invite)

**Supabase:**
- Dashboard: https://app.supabase.com
- Docs: https://supabase.com/docs
- SQL Editor (try queries before writing backend code)

**SendGrid:**
- API Docs: https://docs.sendgrid.com/api-reference
- Dashboard: https://app.sendgrid.com

**Vercel:**
- Deploy docs: https://vercel.com/docs
- Dashboard: https://vercel.com/dashboard

**Railway:**
- Deploy docs: https://docs.railway.app
- Dashboard: https://railway.app

---

## Final Reminders

- **Scope is real:** 7 days is tight. Cut features ruthlessly. MVP first, polish later.
- **Tests are your friend:** Write tests as you go, not at the end.
- **Communication saves days:** Daily standups catch blockers early.
- **Edge cases matter:** Judges test underpayment, overpayment, misdirected payments. You must handle them.
- **Demo is everything:** Build a compelling 5-minute walkthrough. Practice it 5 times.
- **Submission is 11:59 PM WAT:** Plan to be done by 11 AM. Buffer for last-minute fixes.

---

## Next Steps (Right Now)

1. **Emerald:** Read PRODUCT_SPEC.md, then ARCHITECTURE.md (design all systems)
2. **Frontend Dev:** Read PRODUCT_SPEC.md, then start ROADMAP.md Day 1 tasks
3. **Backend Dev:** Read ARCHITECTURE.md, then start ROADMAP.md Day 1 tasks
4. **Team:** Set up Slack channel, GitHub repo, Google Doc for shared notes
5. **All:** Review ROADMAP.md, mark calendar for daily standups

---

**Let's build this. Ship it. Win it. 🚀**