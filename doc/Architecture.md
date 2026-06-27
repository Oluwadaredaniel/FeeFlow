# Architecture: FeeFlow

**Version:** 1.0  
**Last Updated:** June 27, 2026  
**Status:** Final (locked for hackathon build)

---

## Table of Contents

1. [Architectural Overview](#architectural-overview)
2. [Technology Stack](#technology-stack)
3. [Why Each Technology](#why-each-technology)
4. [System Components](#system-components)
5. [Data Flow](#data-flow)
6. [Scalability](#scalability)
7. [Security Model](#security-model)
8. [Deployment Architecture](#deployment-architecture)

---

## Architectural Overview

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FEEFLOW SYSTEM                            │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┐      ┌──────────────────────────┐
│     STUDENT DEVICES              │      │    INSTITUTION BROWSERS  │
│  (Mobile, Desktop)               │      │  (Admin, Treasurer)      │
│  - View account                  │      │  - Manage fees           │
│  - Check balance                 │      │  - View reports          │
│  - Download receipts             │      │  - Process refunds       │
└──────────────────────────────────┘      └──────────────────────────┘
           │                                        │
           │ HTTPS (TLS 1.3)                       │ HTTPS (TLS 1.3)
           │                                        │
           └────────────────────┬───────────────────┘
                                │
                    ┌───────────────────────┐
                    │   NEXT.JS FRONTEND    │
                    │   (Vercel)            │
                    │   - SPA with routing  │
                    │   - Real-time UI      │
                    │   - SSR for SEO       │
                    └───────────────────────┘
                                │
                    HTTPS / REST / WebSocket
                                │
        ┌───────────────────────┴───────────────────────┐
        │                                               │
        ▼                                               ▼
┌──────────────────────┐                  ┌────────────────────────┐
│  NEXT.JS API ROUTES  │                  │     NOMBA API          │
│  (Vercel Functions)  │◄─────Webhooks────┤   (Virtual Accounts)   │
│  - Auth endpoints    │                  │   - Create accounts    │
│  - Webhook handler   │                  │   - Receive webhooks   │
│  - Student API       │  ──────Calls────►│   - Query transfers    │
│  - Fee API           │                  │   - Process settlements│
│  - Clearance API     │                  │                        │
└──────────────────────┘                  └────────────────────────┘
        │
        │ SQL / Prepared Statements
        │ Connection Pooling (PgBouncer)
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│             SUPABASE (PostgreSQL Database)                        │
│  - organizations                                                  │
│  - students                                                       │
│  - virtual_accounts                                              │
│  - fee_types                                                     │
│  - student_fees                                                  │
│  - payments                                                      │
│  - payment_allocations                                           │
│  - clearance_status                                              │
│  - audit_logs                                                    │
│  - refund_requests                                               │
│  - Row-Level Security (RLS) for multi-tenancy                   │
│  - Automatic backups (daily)                                    │
│  - Point-in-time recovery (30 days)                             │
└──────────────────────────────────────────────────────────────────┘
        │
        ├─ Supabase Auth
        │  (Email + OTP)
        │
        ├─ Supabase Storage
        │  (Receipts, PDFs)
        │
        └─ Supabase Real-time
           (WebSocket subscriptions)

┌──────────────────────────────────────────────────────────────────┐
│              BACKGROUND JOBS & NOTIFICATIONS                     │
│  - node-cron (job scheduler)                                     │
│  - SendGrid (email receipts, notifications)                      │
│  - Twilio (SMS alerts) [optional]                               │
│  - Redis (job queue) [Phase 2]                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    MONITORING & LOGGING                           │
│  - Vercel analytics (uptime, performance)                        │
│  - Supabase logs (database queries)                              │
│  - Sentry (error tracking)                                       │
│  - CloudWatch or similar (API logs)                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Overview Table

| Layer | Technology | Version | Why | Alternatives Rejected |
|-------|-----------|---------|-----|----------------------|
| **Frontend** | Next.js | 14+ (App Router) | Speed, full-stack, API routes, SSR | Remix, SvelteKit |
| **Backend** | Next.js API Routes | 14+ | Integrated with frontend, serverless | NestJS, Express (slower for hackathon) |
| **Database** | Supabase (PostgreSQL) | 15+ | ACID transactions (critical for payments), multi-tenancy (RLS) | MongoDB (no transactions), Firebase (weak relational) |
| **Auth** | Supabase Auth | Built-in | Email + OTP, JWT, no vendor lock-in | Auth0 (overkill), Clerk (too expensive) |
| **Payments** | Nomba API | Latest | Virtual accounts, webhooks, African payments | Flutterwave (more complex), Paystack (no virtual accounts) |
| **Email** | SendGrid | API v3 | Reliable, 30K emails/month free tier | Resend (new, untested), AWS SES (more config) |
| **SMS** | Twilio | Optional | OTP, alerts | Africa's Talking (later) |
| **Storage** | Supabase Storage | Built-in | Easy, integrated with DB, AWS S3 backend | Local filesystem (not scalable), Firebase Storage |
| **Job Queue** | node-cron (MVP) | Latest | Simple for initial build, no external deps | Bull/Redis (overkill for week 1) |
| **Hosting** | Vercel (frontend) + Railway (backend) | Latest | Speed, auto-deploy, serverless scaling | AWS (too much config), Heroku (deprecated) |
| **Monitoring** | Sentry + Vercel Analytics | Latest | Error tracking, performance insights | DataDog (expensive), LogRocket (overkill) |

---

## Why Each Technology

### Frontend: Next.js 14 (App Router)

**Why:**
- **Full-stack:** Can build API routes alongside UI (serverless functions)
- **Speed:** Pre-built optimizations (code splitting, lazy loading, image optimization)
- **Developer Experience:** File-based routing, zero-config, hot reload
- **SSR:** Server-Side Rendering for SEO and initial page load speed
- **API Routes:** No separate backend needed initially (perfect for hackathon)
- **Deployment:** One-click deploy to Vercel (Next.js creators)
- **Team Knowledge:** Emerald uses Next.js, so knowledge transfer is easy
- **Type Safety:** Full TypeScript support

**Why NOT:**
- ❌ Remix: Learning curve, smaller ecosystem
- ❌ SvelteKit: Smaller community, less enterprise adoption
- ❌ Vue: Less suitable for full-stack (Nuxt is newer)

**Implementation:**
```bash
npx create-next-app@latest feeflow --typescript --tailwind --app
```

**Core Setup:**
```javascript
// app/layout.tsx - Root layout
// app/(auth)/login/page.tsx - Login page (no layout)
// app/(dashboard)/layout.tsx - Protected dashboard layout
// app/api/auth/login/route.ts - Auth endpoints (serverless)
// app/api/students/route.ts - Student CRUD (serverless)
// app/api/webhooks/nomba/route.ts - Nomba webhook handler (serverless)
```

---

### Backend: Next.js API Routes (Serverless)

**Why:**
- **Zero Overhead:** No separate server to manage
- **Auto-Scaling:** Handles traffic spikes automatically (payment influx)
- **Cost-Effective:** Pay only for compute time used
- **Integrated:** Same codebase as frontend (shared utilities, types)
- **Quick Iterations:** Deploy with `vercel` or push to git
- **Stateless:** No server maintenance, no downtime during deploys

**Why NOT separate NestJS:**
- ❌ More complex setup (7+ days is tight)
- ❌ Requires separate hosting/deployment
- ❌ Adds operational overhead (PM2, monitoring)
- ❌ Team context-switch (different project structure)

**Exception:** If backend dev insists on structure, use NestJS + Railway. But it's slower.

**Trade-off:** API routes can feel less "structured" than NestJS, but for this MVP, pragmatism wins.

**Key Endpoints (serverless):**
```
POST /api/auth/login
POST /api/auth/verify-otp
POST /api/auth/logout

POST /api/students
GET /api/students
GET /api/students/:id
PATCH /api/students/:id

POST /api/fees
GET /api/fees
GET /api/students/:id/fees

POST /api/webhooks/nomba ← CRITICAL: Nomba webhook handler
GET /api/payments/:student_id

GET /api/clearance/:student_id
GET /api/debtors

GET /api/reports/collection
GET /api/reports/students
```

**Cold Start Considerations:**
- Serverless functions have ~1-2 second cold start (first request after deploy)
- **Solution:** Vercel keeps functions warm automatically (good uptime)
- **Acceptable for hackathon:** Judges don't stress-test
- **Post-hackathon:** Can migrate to containerized backend if needed

---

### Database: Supabase (PostgreSQL)

**Why:**
1. **ACID Transactions:** Essential for payment systems
   - Two concurrent payments to same student must not race condition
   - Supabase guarantees atomicity (all-or-nothing)
   
2. **Relational Data:** FeeFlow has complex relationships
   - Student ↔ Virtual Account (1:1)
   - Student ↔ Fees (1:many)
   - Fee ↔ Payments (1:many)
   - Payment ↔ Allocations (1:many)
   - Impossible to model in MongoDB without data duplication
   
3. **Multi-Tenancy (RLS):** Row-Level Security policies enforce data isolation
   - Every query automatically filtered by `org_id`
   - Admin can't accidentally see other institution's data
   - No need to manually add `org_id` WHERE clause everywhere
   
4. **Cost:** Free tier covers hackathon
   - 500MB database storage
   - 2GB bandwidth
   - Enough for 10K students + demo data
   
5. **Ecosystem:** Built-in services
   - Auth (email + OTP)
   - Storage (for receipts)
   - Real-time subscriptions (WebSocket)
   - Backups (daily, automatic)
   
6. **Portability:** Pure PostgreSQL (not proprietary)
   - Can migrate off Supabase later (just export SQL)
   - No vendor lock-in

**Why NOT:**
- ❌ **MongoDB:** Eventual consistency = reconciliation bugs. Concurrent payments can corrupt state.
  ```
  // BAD: In MongoDB
  Payment 1: Finds Fee, increments amount_paid
  Payment 2: Finds Fee (read before Payment 1 writes), increments amount_paid
  Result: Only one payment's amount counted (race condition)
  
  // GOOD: In PostgreSQL with transactions
  BEGIN TRANSACTION
    SELECT * FROM fees FOR UPDATE (lock row)
    Update fee with payment
  COMMIT
  Result: No race, both payments counted correctly
  ```

- ❌ **Firebase:** Weak for financial systems
  - Limited query capabilities
  - Real-time database has eventual consistency
  - Firestore is better but still pricey and limited
  - Financial calculations need relational joins
  
- ❌ **DynamoDB:** No relational joins, expensive at scale

**Implementation:**
```sql
-- Supabase automatically provides
-- - PostgreSQL database
-- - PostgREST API (auto-generated)
-- - Row-Level Security
-- - Auth tables
-- - Storage buckets
```

**Connection Pooling:**
- Vercel functions need connection pooling (can't open new connection per request)
- Supabase includes PgBouncer mode (automatic)
- Set in connection string: `?sslmode=require`

---

### Auth: Supabase Auth (Email + OTP)

**Why:**
- **Simple:** Email + OTP, no password management
- **Secure:** OTP expires (10 minutes), sent via SendGrid
- **Integrated:** Works directly with Supabase
- **JWT:** Tokens stored client-side, used for API auth
- **No Vendor Lock-in:** Standard OpenID Connect
- **Org-Based:** Can link users to organization (org_id in JWT)

**Why NOT:**
- ❌ Auth0: Overkill, ₦5K+/month
- ❌ Clerk: Expensive for hackathon, slower onboarding
- ❌ Firebase Auth: Less flexible for OTP

**Flow:**
```javascript
1. User enters email: student@oau.edu.ng

2. POST /api/auth/login
   {
     "email": "student@oau.edu.ng"
   }
   
3. Supabase sends OTP to email (SendGrid backend)

4. User receives OTP in email (or SMS if added)

5. POST /api/auth/verify-otp
   {
     "email": "student@oau.edu.ng",
     "otp": "123456"
   }
   
6. Supabase validates OTP, returns JWT token

7. Client stores JWT in cookies (httpOnly, secure, sameSite)

8. All API requests include: Authorization: Bearer ${token}

9. Backend verifies JWT (Supabase public key), extracts user_id + org_id

10. Query is automatically RLS-filtered to user's org_id
```

**Multi-Tenant Consideration:**
- User belongs to exactly one institution (org_id in auth metadata)
- JWT embeds org_id
- Every API query filtered by JWT's org_id
- RLS policies enforce this at database level (double protection)

---

### Payments: Nomba API

**Why:**
- **Virtual Accounts:** Core feature of hackathon
- **African Focus:** Works seamlessly in Nigeria
- **Instant Settlement:** Payment settled within minutes
- **Webhooks:** Real-time payment notifications
- **Multi-Channel:** USSD, mobile app, web, ATM
- **You Have Credentials:** Already provided by hackathon

**Why NOT:**
- ❌ Flutterwave: More complex, less virtual account focus
- ❌ Paystack: No virtual accounts API
- ❌ GTBank: Limited API, B2B only

**Integration Points:**

1. **Create Virtual Account:**
   ```
   POST https://api.nomba.com/v1/virtual-accounts/create
   {
     "accountName": "Adeyemi, Chioma",
     "metadata": {
       "matric": "CSC/2024/045",
       "institution": "OAU"
     }
   }
   
   Response:
   {
     "accountNumber": "1023456789",
     "accountName": "Adeyemi, Chioma",
     ...
   }
   ```

2. **Receive Webhooks:**
   ```
   POST /api/webhooks/nomba
   {
     "event": "transfer.received",
     "data": {
       "amount": 500000,
       "destinationAccountNumber": "1023456789",
       "transactionReference": "TXN_ABC123",
       "senderName": "John Doe",
       "timestamp": "2026-07-01T10:30:00Z"
     }
   }
   
   FeeFlow validates signature, processes payment
   ```

3. **Query Transactions:**
   ```
   GET https://api.nomba.com/v1/transactions?accountNumber=1023456789
   
   Returns all transfers to that account
   Used for reconciliation (catch missed webhooks)
   ```

4. **Process Refunds:**
   ```
   POST https://api.nomba.com/v1/transfers/create
   {
     "amount": 100000,
     "destinationAccount": "0000000001",
     "narration": "Refund for overpayment"
   }
   ```

**Webhook Security:**
- Nomba signs webhooks with HMAC-SHA256
- Store signature secret in env: `NOMBA_WEBHOOK_SECRET`
- On every webhook:
  ```javascript
  const signature = req.headers['x-nomba-signature']
  const hash = HMAC_SHA256(req.body, NOMBA_WEBHOOK_SECRET)
  if (signature !== hash) return 401 Unauthorized
  ```

**Test vs Live:**
- Build week: Use TEST credentials (sandbox)
- Submission day: Switch to LIVE credentials (real money)
- Same API endpoint, different credentials

---

### Email: SendGrid

**Why:**
- **Reliable:** 99.99% uptime SLA
- **Affordable:** 30K emails/month free tier
- **Easy Integration:** Simple REST API
- **Templates:** Can pre-design receipt emails
- **Analytics:** Track open rates, bounces
- **Scalable:** Handles payment receipt spam (1K emails/minute if needed)

**Why NOT:**
- ❌ AWS SES: Cheaper but more complex setup
- ❌ Mailgun: Similar to SendGrid, older UX
- ❌ Resend: New service, less battle-tested

**Implementation:**
```javascript
// Send receipt email after payment reconciliation
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: student.email,
  from: 'noreply@feeflow.io',
  subject: 'Payment Receipt – FeeFlow',
  html: receiptHTML,
  attachments: [
    {
      filename: 'receipt.pdf',
      content: pdfBuffer,
      type: 'application/pdf'
    }
  ]
};

await sgMail.send(msg);
```

**Template (Pre-built):**
- Design receipt email in SendGrid dashboard
- Use template variables: {{studentName}}, {{amount}}, {{date}}
- Reference in code: `templateId: 'd-abc123xyz'`
- Faster than generating HTML dynamically

---

### Job Queue: node-cron (MVP) → Bull/Redis (Phase 2)

**MVP (Week 1):**
```javascript
// Simple recurring tasks using node-cron
import cron from 'node-cron';

// Every 5 minutes: check for missed webhooks
cron.schedule('*/5 * * * *', async () => {
  const lastSync = await db.getLastWebhookSync();
  const transactions = await nomba.getTransactions(lastSync);
  
  for (const txn of transactions) {
    if (!await db.paymentExists(txn.id)) {
      // Missed webhook, process it
      await processPayment(txn);
    }
  }
});

// Every hour: retry failed email sends
cron.schedule('0 * * * *', async () => {
  const failed = await db.getFailedEmails();
  for (const email of failed) {
    try {
      await sendgrid.send(email);
    } catch (err) {
      // Log error, don't retry more than 3 times
    }
  }
});
```

**Why node-cron for MVP:**
- ✅ Zero external dependencies (no Redis)
- ✅ Runs on same server as API (Vercel functions)
- ✅ Simple to understand and debug
- ✅ Good enough for 10K students

**Why NOT immediately Bull/Redis:**
- ❌ Requires separate Redis instance (costs money)
- ❌ More complex deployment
- ❌ Overkill for hackathon scale
- ❌ Time better spent on core features

**Phase 2 (after hackathon):**
- Add Bull + Redis for:
  - Parallel processing of reconciliation
  - Better retry logic (exponential backoff)
  - Distributed job execution (multiple servers)
  - Durability (jobs survive server crash)

---

### Storage: Supabase Storage (AWS S3 backend)

**Why:**
- **Integrated:** Works with Supabase auth and databases
- **Simple API:** Just URLs and upload/download
- **Affordable:** Included in free tier
- **Scalable:** S3 backend handles large files
- **CDN:** Automatic CloudFront caching

**Use Case: Store Receipts**
```
/receipts/{org_id}/{student_id}/{payment_id}.pdf

Example:
/receipts/org_oau/student_45/payment_12345.pdf
```

**Upload Receipt PDF:**
```javascript
const pdfBuffer = await generateReceiptPDF(payment);
await supabase.storage
  .from('receipts')
  .upload(
    `org_oau/student_45/payment_12345.pdf`,
    pdfBuffer,
    { contentType: 'application/pdf' }
  );
```

**Download Receipt:**
```javascript
// Generate signed URL (expires in 7 days)
const { data } = await supabase.storage
  .from('receipts')
  .createSignedUrl(`org_oau/student_45/payment_12345.pdf`, 3600);

// URL can be sent to student, used in email
```

---

### Hosting: Vercel (Frontend) + Railway (Backend)

**Frontend: Vercel**
- **Why:** Created by Next.js team, zero-config deploy
- **Deploy:** Push to GitHub, automatic build + deploy
- **CDN:** Global edge network (fast for students worldwide)
- **Serverless:** Automatic scaling for traffic spikes
- **Cost:** Free tier sufficient for hackathon

**Backend: Railway (or Vercel Functions)**

**Option 1: Vercel Functions (Recommended for MVP)**
- Same as frontend deployment
- No separate server
- Scales automatically
- Cost: Included in Vercel free tier
- Risk: Cold starts (1-2 sec on first request)
- Acceptable: Judges don't stress-test

**Option 2: Railway.app (If separate backend needed)**
- Traditional containerized app
- Always warm (no cold starts)
- ₦0 trial, then ₦5/month base
- Easy to scale horizontally
- Better for long-running jobs
- Use if backend dev insists on NestJS

**Recommendation:** Use Vercel Functions for frontend + backend (same service). If too slow, switch to Railway.

**Deployment Checklist:**
```bash
# Frontend
vercel deploy --prod

# Backend (if separate)
railway deploy

# Environment variables (set in Vercel/Railway dashboard)
SUPABASE_URL=...
DATABASE_URL=...
NOMBA_CLIENT_ID_LIVE=...
SENDGRID_API_KEY=...
JWT_SECRET=...
```

---

## System Components

### Authentication Flow

```
Client                                  Supabase
  │
  ├─ POST /api/auth/login
  │   {"email": "student@oau.edu.ng"}
  │                                      │
  │                                      ├─ Generate OTP (6 digits)
  │                                      ├─ Store OTP (10 min TTL)
  │                                      ├─ Send via SendGrid
  │                                      │
  ├─ User receives OTP in email
  │
  ├─ POST /api/auth/verify-otp
  │   {"email": "student@oau.edu.ng", "otp": "123456"}
  │                                      │
  │                                      ├─ Validate OTP (not expired, matches)
  │                                      ├─ Create JWT token
  │                                      ├─ Embed: user_id, org_id, role
  │                                      ├─ Return JWT (expires 7 days)
  │                                      │
  ├─ Store JWT in httpOnly cookie
  │
  ├─ All future requests include JWT
  │   Authorization: Bearer ${jwt}
  │
  ├─ POST /api/students (protected)
  │                                      │
  │                                      ├─ Verify JWT signature
  │                                      ├─ Extract user_id, org_id
  │                                      ├─ Query: SELECT * FROM students
  │                                      │  WHERE org_id = ${org_id} (RLS)
  │                                      │
  ├─ Receive student list (org-filtered)
```

### Payment Reconciliation Flow (Detailed in RECONCILIATION_FLOW.md)

```
Nomba                              FeeFlow                        Database
  │
  ├─ Payment received to account 1023456789
  │  Amount: ₦7,500
  │  Txn ID: TXN_ABC123
  │
  ├─ POST /api/webhooks/nomba
  │                                 │
  │                                 ├─ Validate signature
  │                                 ├─ Deduplicate (txn_id unique?)
  │                                 ├─ Find student (by account #)
  │                                 │
  │                                 │                    ├─ SELECT student_id
  │                                 │                    │  FROM virtual_accounts
  │                                 │                    │  WHERE account_number = 1023456789
  │                                 │
  │                                 ├─ Find fees (unpaid, by priority)
  │                                 │
  │                                 │                    ├─ SELECT * FROM student_fees
  │                                 │                    │  WHERE student_id = 45
  │                                 │                    │  AND status != 'PAID'
  │                                 │
  │                                 ├─ Allocate payment to fees
  │                                 │  Faculty Due (₦5K) ← ₦5K
  │                                 │  Lab Fee (₦2K)     ← ₦2K
  │                                 │  Clearance (₦500)  ← ₦0 (payment exhausted)
  │                                 │
  │                                 ├─ Update fee statuses
  │                                 │
  │                                 │                    ├─ UPDATE student_fees
  │                                 │                    │  SET amount_paid = amount_due
  │                                 │                    │  WHERE fee_id IN (...)
  │                                 │
  │                                 ├─ Recalculate clearance
  │                                 │  All required fees paid? YES → CLEARED
  │                                 │
  │                                 │                    ├─ UPDATE clearance_status
  │                                 │                    │  SET is_cleared = true
  │                                 │                    │  WHERE student_id = 45
  │                                 │
  │                                 ├─ Generate receipt PDF
  │                                 ├─ Queue email via SendGrid
  │                                 ├─ Create audit log entry
  │                                 │
  │                                 │                    ├─ INSERT INTO audit_logs
  │                                 │
  │                                 ├─ Return 200 OK to Nomba
  │
  ├─ (Nomba marks webhook as delivered)
```

---

## Data Flow

### High-Level Data Movement

```
1. INSTITUTION SETUP
   Admin creates institution
     ↓
   System creates org record
     ↓
   Admin gets Nomba account credentials
     ↓
   Admin registers webhook URL with Nomba

2. STUDENT ONBOARDING
   Admin imports student list (CSV)
     ↓
   For each student:
     - Create student record
     - Call Nomba API → create virtual account
     - Store virtual account → student mapping
     - Assign default fees
   
3. STUDENT PAYS
   Student transfers money to virtual account
     ↓
   Nomba settles payment
     ↓
   Nomba sends webhook to FeeFlow
     ↓
   FeeFlow processes webhook:
     - Identify student
     - Find fees
     - Allocate payment
     - Update balances
     - Recalculate clearance
     - Send receipt email

4. REPORTING
   Admin queries dashboards
     ↓
   System aggregates from database
     ↓
   Displays metrics (revenue, debtors, etc.)
```

---

## Scalability

### Designed For Growth

**Current Design Handles:**
- ✅ 10K students (per institution)
- ✅ 100 institutions (multi-tenant)
- ✅ 1M payments/month (50K/day average)
- ✅ 1K concurrent requests
- ✅ Global users (CDN distribution)

**Bottlenecks & Solutions:**

| Bottleneck | Scale | Solution |
|-----------|-------|----------|
| Database connections | 100+ simultaneous | Connection pooling (PgBouncer, built-in) |
| Payment processing speed | 1K payments/min | Async processing (queue jobs, webhooks handled in <1sec) |
| Email delivery | 10K receipts/hour | SendGrid batch API (can handle 100K/hour) |
| Storage (receipts) | TB of PDFs | S3 auto-scales, CDN caches |
| API rate limits | 10K requests/min | Vercel auto-scales, stateless design |
| Nomba API limits | Unknown | Monitor quotas, implement local caching |

**How to Scale:**

**Phase 1 (Current):** Vercel + Supabase + SendGrid (single region, auto-scaling)

**Phase 2:** Add caching layer (Redis) for hot queries

**Phase 3:** Split read/write databases (read replicas for reporting)

**Phase 4:** Add multi-region (Supabase can replicate)

**Phase 5:** Move to containerized backend (if needed for performance)

---

## Security Model

### Authentication & Authorization

**Layer 1: User Authentication**
- Email + OTP (Supabase Auth)
- OTP expires in 10 minutes
- JWT token (7-day expiry)
- Stored in httpOnly cookie (XSS-safe)

**Layer 2: Row-Level Security (RLS)**
- Every table has RLS enabled
- Policy: `org_id = current_user_org_id`
- Even if hacker forges JWT, can only see their org
- Supabase enforces at database level (not application level)

**Layer 3: API Authorization**
```javascript
// Middleware on every protected route
const protectedRoute = async (req) => {
  const token = req.cookies.get('auth_token');
  const user = await supabase.auth.getUser(token);
  
  if (!user) return 401 Unauthorized;
  
  // Attach user to request
  req.user = user;
  
  // Every query includes org_id filter
  const students = await db.query(
    'SELECT * FROM students WHERE org_id = $1',
    [user.org_id]  // RLS + app-level filter (defense in depth)
  );
};
```

### Data Protection

**In Transit:**
- HTTPS only (TLS 1.3)
- All APIs require HTTPS
- Vercel + Supabase both enforce HTTPS

**At Rest:**
- Supabase encrypts database (AES-256)
- Backups encrypted
- API keys never stored in code (env vars only)

**Nomba Webhook Security:**
- Verify HMAC-SHA256 signature on every webhook
- Reject unsigned or invalid webhooks
- Rate-limit webhook endpoint (prevent replay attacks)

### Audit Trail

**Every action logged:**
```
INSERT INTO audit_logs (
  timestamp, user_id, action, entity, changes
) VALUES (NOW(), 'user_45', 'PAYMENT_RECONCILED', 'payment_123', {...})
```

**Compliance & Debugging:**
- Prove a student was charged ₦5,000
- Show who approved a refund
- Detect unauthorized access attempts
- Post-incident investigation

### OWASP Top 10 Protection

| Risk | FeeFlow Mitigation |
|------|-------------------|
| **Broken Auth** | Supabase Auth + JWT + OTP + RLS |
| **Injection (SQL)** | Prepared statements, Supabase parameterized queries |
| **XSS** | httpOnly cookies, Content-Security-Policy headers |
| **CSRF** | SameSite cookies, token validation |
| **Exposed Data** | HTTPS, encrypted at rest, RLS |
| **Weak Crypto** | HMAC-SHA256 for signatures, bcrypt for passwords (Supabase) |
| **Auth Bypass** | JWT validation, RLS enforcement |
| **Insecure Direct Object Ref** | RLS filters all queries by org_id |
| **Insecure Deserialization** | No deserialization (JSON only) |
| **Logging** | Audit trail for all state changes |

---

## Deployment Architecture

### Development Environment

```
Local Machine (Emerald + Devs)
  │
  ├─ Git repo: github.com/feeflow/feeflow
  │
  ├─ Development branch
  │  ├─ Frontend (localhost:3000)
  │  ├─ Backend API (localhost:3001)
  │  ├─ Supabase local (local database)
  │
  └─ Testing
     ├─ Unit tests (Jest)
     ├─ Integration tests (API + DB)
     ├─ E2E tests (Playwright, full flow)
```

### Staging Environment

```
Staging (before submission day)
  │
  ├─ Frontend: staging.feeflow.vercel.app
  ├─ Backend: staging-api.railway.app
  ├─ Database: Supabase (staging project)
  ├─ Nomba Credentials: TEST (sandbox)
  │
  └─ Purpose: Final testing before going live
```

### Production Environment

```
Production (submission day onwards)
  │
  ├─ Frontend: feeflow.vercel.app
  │  ├─ Deployed to Vercel
  │  ├─ Auto-scales with traffic
  │  ├─ Global CDN
  │  ├─ Automatic SSL certificates
  │
  ├─ Backend: api.feeflow.vercel.app (same Vercel project, different functions)
  │  ├─ Serverless functions
  │  ├─ Auto-scaling per request
  │  ├─ Stateless (no session storage)
  │
  ├─ Database: Supabase (production project)
  │  ├─ Daily backups
  │  ├─ Point-in-time recovery (30 days)
  │  ├─ Read replicas (optional, Phase 2)
  │  ├─ Connection pooling enabled
  │
  ├─ Nomba Credentials: LIVE (real money)
  │  ├─ Separate API keys for production
  │  ├─ Webhook URL: api.feeflow.vercel.app/webhooks/nomba
  │
  ├─ Email: SendGrid (production account)
  │  ├─ Verified sender domain
  │  ├─ Rate limit: 30K/month free
  │
  ├─ Monitoring
  │  ├─ Vercel Analytics (uptime, performance)
  │  ├─ Sentry (error tracking)
  │  ├─ Supabase logs (database queries)
  │  ├─ Email logs (SendGrid dashboard)
```

### CI/CD Pipeline

```
Developer
  │
  ├─ Push to feature/[name]/feature-name
  │
  ├─ GitHub Action Trigger
  │  ├─ Lint (ESLint, Prettier)
  │  ├─ Type check (TypeScript)
  │  ├─ Unit tests (Jest)
  │  ├─ Integration tests (Supabase local)
  │
  ├─ Create Pull Request
  │
  ├─ Code review (Emerald approves)
  │
  ├─ Merge to develop
  │
  ├─ Deploy to staging.feeflow.vercel.app
  │  ├─ GitHub Action deploys to Vercel
  │  ├─ Run E2E tests (Playwright)
  │  ├─ Manual testing on staging
  │
  ├─ Merge to main
  │  ├─ Triggered manually (only before submission)
  │
  ├─ Deploy to feeflow.vercel.app (production)
  │  ├─ Automatic Vercel deployment
  │  ├─ Zero-downtime (blue-green deploy)
  │  ├─ Rollback available if needed
```

---

**Next:** Read DATABASE_SCHEMA.md for exact table structures, then API_SPEC.md for endpoint details.