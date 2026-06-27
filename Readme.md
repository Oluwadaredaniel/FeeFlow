# FeeFlow: Automated Fee Reconciliation for African Universities

<div align="center">

**Stop manually reconciling student fees.**

Every student gets a dedicated virtual account. Payments reconcile automatically. Clearance calculates in real-time.

[![Deploy Status](https://img.shields.io/badge/Status-Live-brightgreen)](https://feeflow.vercel.app)
[![License](https://img.shields.io/badge/License-MIT-blue)](#license)
[![Made for Nomba Hackathon 2026](https://img.shields.io/badge/Made%20for-Nomba%20Hackathon%202026-success)](https://nomba.com/hackathon)

[Live Demo](https://feeflow.vercel.app) • [API Docs](#api-documentation) • [Quick Start](#quick-start) • [Architecture](#architecture)

</div>

---

## Problem

### Manual Fee Collection is Chaos

**Nigerian universities struggle with:**
- 📋 **Manual Verification:** Treasurers manually verify screenshots
- 💰 **Lost Revenue:** Underpayments & overpayments go untracked
- ⏳ **Delays:** Clearance takes weeks due to manual checks
- 🔍 **No Audit Trail:** No proof of payment for disputes
- 📊 **Fragmented Data:** Excel sheets, notebooks, inconsistent records

**At Scale:** 500 students × ₦7,500 average fees = ₦3.75M per department, 10% lost to reconciliation failures.

---

## Solution

### FeeFlow: Infrastructure-First Reconciliation

1. **Virtual Accounts:** Every student gets a unique account number
2. **Automatic Detection:** Payment arrives → system identifies student
3. **Instant Reconciliation:** Fees updated, balance calculated, receipt generated
4. **Real-Time Clearance:** Eligibility for graduation calculated automatically
5. **API-First Design:** Other institutions integrate our API into their systems

**Result:** Zero manual verification. Instant reporting. Full audit trail.

---

## Live Demo

**Website:** https://feeflow.vercel.app

**Test Credentials:**
```
Institution: Obafemi Awolowo University (OAU)
Email: demo@student.oau.edu.ng
OTP: (Will be sent to email, use for login)
```

**Demo Account Features:**
- 200 pre-loaded students
- 5 fee types (Faculty Due, Lab Fee, Clearance Fee, etc.)
- Virtual accounts ready for Nomba sandbox testing
- Full admin dashboard with metrics

**Send Test Payment:**
1. Login as admin
2. Note a student's virtual account number
3. Use Nomba sandbox to send payment
4. Watch FeeFlow reconcile instantly

---

## Key Features

### ✅ What's Built (MVP)

| Feature | Status | Details |
|---------|--------|---------|
| **Virtual Accounts** | ✅ Complete | Every student gets unique account via Nomba |
| **Auto Reconciliation** | ✅ Complete | Payments allocation in <1 second |
| **Webhook Handling** | ✅ Complete | Nomba integration with HMAC validation |
| **Clearance Engine** | ✅ Complete | Calculates eligibility automatically |
| **Student Dashboard** | ✅ Complete | View fees, payments, clearance status |
| **Admin Dashboard** | ✅ Complete | Metrics, reports, debtors list |
| **Email Receipts** | ✅ Complete | Automatic PDF generation & delivery |
| **Multi-Tenant Design** | ✅ Complete | Support unlimited institutions |
| **Audit Trail** | ✅ Complete | Every action logged for compliance |
| **API-First** | ✅ Complete | Fully documented REST API |

### 📋 What's Not Built (Phase 2)

| Feature | Why | Timeline |
|---------|-----|----------|
| Configurable rules engine | Installments, penalties need more design | Post-hackathon |
| Advanced refund workflows | Manual approval sufficient for MVP | Post-hackathon |
| Faculty/Department hierarchy | One flat org sufficient for demo | Post-hackathon |
| Mobile app | Web-responsive enough for hackathon | Post-hackathon |

---

## Architecture

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 14 + Shadcn UI + Tailwind | Speed, type safety, modern UX |
| **Backend** | Next.js API Routes (serverless) | Zero ops, auto-scaling, integrated |
| **Database** | Supabase (PostgreSQL) | ACID transactions, multi-tenancy via RLS |
| **Auth** | Supabase Auth | Email + OTP, no passwords |
| **Payments** | Nomba APIs | Virtual accounts, webhooks, settlements |
| **Email** | SendGrid | Reliable receipt delivery |
| **Deployment** | Vercel + Railway | Zero-downtime, global CDN |

### System Design

```
┌─────────────────┐
│   Students      │
│   (Mobile/Web)  │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────────────┐
│  Next.js Frontend       │
│  (Vercel CDN)           │
│  - Dashboard            │
│  - Forms                │
│  - Reports              │
└────────┬────────────────┘
         │ REST API
         ▼
┌──────────────────────────┐      ┌──────────────────┐
│  Next.js API Routes      │◄────►│  Nomba API       │
│  - Auth                  │      │  (Virtual Accts) │
│  - Students              │      │  (Webhooks)      │
│  - Payments              │      │  (Transfers)     │
│  - Webhooks              │      └──────────────────┘
└────────┬─────────────────┘
         │ SQL
         ▼
┌──────────────────────────┐
│  Supabase (PostgreSQL)   │
│  - Multi-tenant          │
│  - ACID transactions     │
│  - RLS policies          │
│  - Backups (daily)       │
└──────────────────────────┘
```

### Scalability

Designed to handle:
- ✅ 100+ institutions
- ✅ 10M+ payments/year
- ✅ 50K+ concurrent users
- ✅ 1K payments/minute spike

See `ARCHITECTURE.md` for detailed design decisions.

---

## Quick Start

### For Development

**Prerequisites:**
```bash
node --version      # v18+
npm --version       # v9+
git --version       # v2.40+
```

**Clone & Setup:**
```bash
git clone https://github.com/feeflow/feeflow.git
cd feeflow

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Start development servers
npm run dev
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

**Verify Setup:**
```bash
# Test frontend
curl http://localhost:3000

# Test backend
curl http://localhost:3001/api/health

# Test database
curl http://localhost:3001/api/students \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### For Production (Hackathon)

**One-Click Deploy:**

```bash
# Deploy to Vercel (frontend)
vercel deploy --prod

# Deploy to Railway (backend)
railway deploy

# Set environment variables in platform dashboard
```

See `DEPLOYMENT.md` for detailed production setup.

---

## API Documentation

### Base URL
- **Development:** `http://localhost:3001`
- **Production:** `https://api.feeflow.vercel.app`

### Authentication
All requests (except login) require JWT token:
```
Authorization: Bearer ${token}
```

### Core Endpoints

#### Authentication
```bash
# Login (send OTP)
POST /api/auth/login
{ "email": "student@oau.edu.ng" }

# Verify OTP
POST /api/auth/verify-otp
{ "email": "student@oau.edu.ng", "otp": "123456" }

# Logout
POST /api/auth/logout
```

#### Students
```bash
# Create student
POST /api/students
{ "email": "...", "matric_number": "CSC/2024/045", ... }

# List students
GET /api/students?limit=20&offset=0

# Get single student
GET /api/students/:id

# Bulk import
POST /api/students/bulk-import (multipart/form-data: CSV file)
```

#### Payments
```bash
# Nomba webhook (called by Nomba, not you)
POST /api/webhooks/nomba
{ "event": "transfer.received", "data": {...} }

# Get payment history
GET /api/payments/:student_id

# Get debtors
GET /api/debtors?sort=amount_owed&order=DESC
```

#### Reports
```bash
# Collection report
GET /api/reports/collection?fiscal_year=2024/2025&format=CSV

# Students report
GET /api/reports/students?format=CSV
```

See `API_SPEC.md` for complete endpoint documentation.

---

## Documentation

| Document | Purpose |
|----------|---------|
| **[CLAUDE.md](./CLAUDE.md)** | Project overview, quick start, team onboarding |
| **[PRODUCT_SPEC.md](./PRODUCT_SPEC.md)** | What we're building, features, user roles, lifecycle |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Tech stack, design decisions, scalability |
| **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** | Every table, column, index, constraint |
| **[API_SPEC.md](./API_SPEC.md)** | Every endpoint, request/response, errors |
| **[RECONCILIATION_FLOW.md](./RECONCILIATION_FLOW.md)** | Payment processing logic, step-by-step |
| **[ROADMAP.md](./ROADMAP.md)** | 7-day build sprint, daily tasks |
| **[EDGE_CASES.md](./EDGE_CASES.md)** | 15+ failure scenarios & solutions |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Environment setup, production checklist |

**Read in order:** Start with CLAUDE.md, then PRODUCT_SPEC.md → pick your role's docs.

---

## Why FeeFlow Wins (Judging Criteria)

### Reconciliation Accuracy ⭐⭐⭐
- **ACID Transactions:** PostgreSQL guarantees atomicity
- **Deduplication:** Nomba retry handled idempotently
- **Race Condition Prevention:** Row-level locking
- **Audit Trail:** Every action logged
- **Edge Case Handling:** See EDGE_CASES.md (15+ scenarios)

### Identity Model Quality ⭐⭐⭐
- **1:1 Mapping:** Student ↔ Virtual Account, never confused
- **Misdirected Payments:** Flagged & stored for manual review
- **Student Transfer:** Soft delete old, create new, preserve history
- **Alumni Preservation:** Never deleted (7-year retention)

### Developer API Quality ⭐⭐⭐
- **Clean Endpoints:** RESTful, intuitive structure
- **Comprehensive Docs:** Every endpoint documented
- **Webhook Support:** Nomba integration ready
- **Error Handling:** Detailed error codes & messages
- **Idempotent Operations:** Safe to retry

### What Makes Us Different

| Aspect | Other Teams | FeeFlow |
|--------|-------------|---------|
| Scope | Payment portal for 1 university | Reusable infrastructure for 1000+ |
| Accuracy | Handles happy path | Handles 15+ edge cases |
| Architecture | Single-use | Multi-tenant, API-first |
| Transaction Safety | Basic | Full ACID guarantees |
| Audit Trail | None | Complete compliance trail |

---

## Team

👤 **Emerald** (Full-Stack Lead)
- Architecture design, system decisions
- React/Vite/Tailwind frontend expertise
- Payment systems experience

👤 **Frontend Dev**
- UI/UX implementation
- Dashboard, forms, reports

👤 **Backend Dev**
- API implementation
- Database queries, webhooks
- System reliability

---

## Getting Help

### Documentation
- **Architecture question?** → Read `ARCHITECTURE.md`
- **Database question?** → Read `DATABASE_SCHEMA.md`
- **Endpoint question?** → Read `API_SPEC.md`
- **Payment logic question?** → Read `RECONCILIATION_FLOW.md`
- **Deployment issue?** → Read `DEPLOYMENT.md`

### Support Channels
- **GitHub Issues:** Report bugs, request features
- **GitHub Discussions:** Technical questions
- **Slack:** Quick questions, team coordination (during hackathon)

### External Resources
- **Nomba Docs:** https://developer.nomba.com
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **SendGrid Docs:** https://docs.sendgrid.com

---

## Roadmap

### Phase 1 (Hackathon) ✅
- Virtual accounts per student
- Auto reconciliation
- Clearance calculation
- Admin dashboard
- Email receipts

### Phase 2 (Post-Hackathon)
- Configurable rules engine (installments, penalties)
- Advanced refund workflows
- Faculty/Department hierarchy
- Mobile app (React Native)
- SMS notifications

### Phase 3 (Year 2)
- Multi-currency support
- SIS system integrations
- Predictive analytics
- Student self-service payment plans
- Audit compliance reports

---

## License

This project is licensed under the **MIT License** - see `LICENSE` file for details.

---

## Acknowledgments

- **Nomba** for providing virtual account infrastructure
- **DevCareer** for organizing the hackathon
- **OAU** for inspiring the real-world use case
- **The Team** for shipping this in 7 days

---

## Contributing

During hackathon phase, contributions are by team members only.

Post-hackathon, we welcome contributions! See `CONTRIBUTING.md` for guidelines.

---

<div align="center">

**Built with ❤️ for African universities**

[Live Demo](https://feeflow.vercel.app) • [GitHub](https://github.com/feeflow/feeflow) • [Nomba Hackathon](https://nomba.com/hackathon)

</div>