# Roadmap: 7-Day Build Sprint

**Dates:** June 27 - July 7, 2026  
**Deadline:** July 7, 11:59 PM WAT (submission closes)  
**Demo Day:** July 19, 2026  

---

## Day 1: Planning & Setup (June 27)

### Objectives
- [ ] Database schema finalized and deployed
- [ ] API specification locked
- [ ] Frontend & backend skeletons ready
- [ ] All team members have working dev environment

### Emerald (Full-Stack Lead)

**Database Setup (2 hours)**
- [ ] Create Supabase project
- [ ] Copy schema from DATABASE_SCHEMA.md into SQL editor
- [ ] Deploy all migrations:
  ```sql
  -- Run all CREATE TABLE statements
  -- Run all CREATE INDEX statements
  -- Enable RLS on all tables
  -- Create RLS policies
  ```
- [ ] Verify tables exist:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public'
  ORDER BY table_name;
  ```
- [ ] Test connection from backend

**Environment Configuration (1 hour)**
- [ ] Create `.env.local` (frontend)
- [ ] Create `.env` (backend)
- [ ] Store Nomba credentials securely (not in code)
- [ ] Generate JWT_SECRET
- [ ] Create `.env.production` for deployment

**Git Repository Setup (1 hour)**
- [ ] Create GitHub repo: feeflow/feeflow
- [ ] Add .gitignore (node_modules, .env, etc.)
- [ ] Create main branches:
  - `main` (production)
  - `develop` (integration)
- [ ] Create GitHub Issues for each day's tasks
- [ ] Create GitHub Projects (Kanban board)
- [ ] Add teammates to repo

**Team Sync (1 hour)**
- [ ] Kickoff meeting (30 min)
  - Review PRODUCT_SPEC.md
  - Review ARCHITECTURE.md
  - Confirm role clarity
- [ ] Setup communication channels:
  - [ ] Slack channel: #feeflow-build
  - [ ] GitHub discussions for technical questions
  - [ ] Calendar block for daily standup (9 AM WAT)

**Handoff Notes for Team**
```markdown
# Day 1 Complete

Database: ✅ Schema deployed, ready to use
Backend: Ready for implementation (Day 2)
Frontend: Ready for setup (Day 2)

Next sync: Tomorrow 9 AM WAT

Blockers: None
```

---

### Frontend Dev

**Next.js Project Setup (1.5 hours)**
- [ ] Create Next.js 14 project:
  ```bash
  npx create-next-app@latest feeflow --typescript --tailwind --app
  ```
- [ ] Install UI libraries:
  ```bash
  npm install shadcn-ui framer-motion axios @supabase/supabase-js
  ```
- [ ] Create folder structure:
  ```
  src/
    app/
      (auth)/login/
      (dashboard)/
    components/
      ui/
      forms/
    lib/
      api.ts
      auth.ts
    styles/
  ```
- [ ] Verify build succeeds:
  ```bash
  npm run build
  ```

**Component Library Setup (1 hour)**
- [ ] Initialize Shadcn UI:
  ```bash
  npx shadcn-ui@latest init
  ```
- [ ] Add initial components:
  ```bash
  npx shadcn-ui@latest add button
  npx shadcn-ui@latest add card
  npx shadcn-ui@latest add form
  npx shadcn-ui@latest add input
  ```

**Stubs for Integration (1 hour)**
- [ ] Create stub layout (`app/layout.tsx`)
- [ ] Create stub pages:
  - `app/(auth)/login/page.tsx`
  - `app/(dashboard)/students/page.tsx`
  - `app/(dashboard)/fees/page.tsx`
- [ ] All pages render without errors

**Handoff Notes**
```markdown
# Frontend Ready

Next.js: ✅ Running on localhost:3000
Tailwind: ✅ Working
Shadcn: ✅ Components available
TypeScript: ✅ Strict mode enabled

No blocking issues. Ready for API integration tomorrow.
```

---

### Backend Dev

**NestJS/Express Setup (1.5 hours)**
- [ ] If using NestJS:
  ```bash
  npm i -g @nestjs/cli
  nest new feeflow-backend
  cd feeflow-backend
  npm install @nestjs/common @nestjs/platform-express
  ```
- [ ] If using Next.js API routes:
  ```bash
  # Setup already done by Frontend Dev
  # Backend will use same Next.js project
  ```

**Database Connection (1 hour)**
- [ ] Install Supabase client:
  ```bash
  npm install @supabase/supabase-js
  ```
- [ ] Create database service:
  ```typescript
  // lib/supabase.ts
  import { createClient } from '@supabase/supabase-js'
  export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
  ```
- [ ] Test connection:
  ```typescript
  const { data, error } = await supabase.from('organizations').select()
  console.log(data)
  ```

**Basic Middleware Setup (1 hour)**
- [ ] Create auth middleware
- [ ] Create logging middleware
- [ ] Create error handler
- [ ] Create health check endpoint:
  ```typescript
  // app/api/health/route.ts
  export async function GET() {
    return Response.json({ status: 'ok' })
  }
  ```

**Handoff Notes**
```markdown
# Backend Ready

Database: ✅ Connected to Supabase
Health check: ✅ http://localhost:3001/health
Middleware: ✅ Basic setup complete

Ready for auth implementation tomorrow.
```

---

## Day 2: Authentication (June 28)

### Objectives
- [ ] Email + OTP login working end-to-end
- [ ] JWT tokens generated and validated
- [ ] Protected routes working
- [ ] Multi-tenancy (org_id) integrated

### Backend Dev + Emerald

**Supabase Auth Setup (2 hours)**
- [ ] Enable Email Provider in Supabase dashboard
- [ ] Configure email templates
- [ ] Create auth helper:
  ```typescript
  // app/api/auth/login/route.ts
  export async function POST(req) {
    const { email } = await req.json()
    const { data, error } = await supabase.auth.signInWithOtp({ email })
    return Response.json({ sent: true })
  }
  ```

**OTP Verification Endpoint (1.5 hours)**
- [ ] Create OTP verify endpoint:
  ```typescript
  // app/api/auth/verify-otp/route.ts
  export async function POST(req) {
    const { email, otp } = await req.json()
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email'
    })
    // Extract JWT, return to client
  }
  ```
- [ ] Generate JWT with org_id embedded
- [ ] Return token to frontend

**Auth Middleware (1.5 hours)**
- [ ] Validate JWT on every protected endpoint
- [ ] Extract user_id and org_id from token
- [ ] Attach to request object
- [ ] Reject requests without valid token

**RLS Policies (1.5 hours)**
- [ ] Create RLS policy for students table:
  ```sql
  ALTER TABLE students ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users see their org" ON students
    FOR SELECT
    USING (auth.jwt() ->> 'org_id' = org_id::text);
  ```
- [ ] Test: Fetch students, verify org_id filter works
- [ ] Repeat for all other tables

### Frontend Dev

**Login Page UI (2 hours)**
- [ ] Create login page:
  ```typescript
  // app/(auth)/login/page.tsx
  export default function LoginPage() {
    return (
      <div>
        <input type="email" placeholder="Email" />
        <button onClick={handleLogin}>Send OTP</button>
      </div>
    )
  }
  ```
- [ ] Input validation (email format)
- [ ] Loading state during submission
- [ ] Error handling

**OTP Input & Verification (1.5 hours)**
- [ ] Show OTP input after email submission
- [ ] Handle 6-digit OTP input
- [ ] Auto-submit when 6 digits entered
- [ ] Handle invalid OTP errors

**Token Management (1.5 hours)**
- [ ] Store JWT in httpOnly cookie:
  ```typescript
  // On successful OTP verification:
  document.cookie = `auth_token=${token}; HttpOnly; Secure; SameSite=Strict`
  ```
- [ ] Create auth context:
  ```typescript
  // lib/auth-context.tsx
  export const useAuth = () => useContext(AuthContext)
  ```
- [ ] Redirect to dashboard on success
- [ ] Redirect to login if not authenticated

### Test Coverage

**Manual Testing:**
- [ ] Login with new email → OTP sent
- [ ] Verify OTP → Token received
- [ ] Refresh page → Stay logged in (token in cookie)
- [ ] Invalid OTP → Error shown
- [ ] Navigate to protected page → Redirects to login if not authenticated

---

## Day 3: Students & Virtual Accounts (June 29)

### Objectives
- [ ] Students can be created via API
- [ ] Virtual accounts auto-created via Nomba
- [ ] Student dashboard shows account number
- [ ] CSV bulk import working

### Backend Dev + Emerald

**Create Student Endpoint (2 hours)**
- [ ] POST /api/students:
  ```typescript
  export async function POST(req) {
    const { email, matric_number, first_name, last_name, department } = await req.json()
    
    // 1. Create student record
    const { data: student, error } = await supabase
      .from('students')
      .insert({
        org_id: req.user.org_id,
        email, matric_number, first_name, last_name, department
      })
      .select()
      .single()
    
    // 2. Call Nomba to create virtual account
    const nombaAccount = await nomba.createVirtualAccount({
      accountName: `${last_name}, ${first_name}`,
      metadata: { matric: matric_number }
    })
    
    // 3. Store virtual account link
    await supabase.from('virtual_accounts').insert({
      student_id: student.id,
      account_number: nombaAccount.accountNumber,
      nomba_account_id: nombaAccount.id
    })
    
    return Response.json(student, { status: 201 })
  }
  ```
- [ ] Error handling:
  - [ ] Missing fields (400 Bad Request)
  - [ ] Duplicate email (409 Conflict)
  - [ ] Nomba API failure (503 Service Unavailable)

**List & Get Student Endpoints (1 hour)**
- [ ] GET /api/students (list all students in org)
- [ ] GET /api/students/:id (get single student)
- [ ] Include virtual account info in response
- [ ] Include fees in response

**Auto-Assign Default Fees (1.5 hours)**
- [ ] When student created, find default fees:
  ```typescript
  const defaultFees = await supabase
    .from('fee_types')
    .select('*')
    .eq('org_id', req.user.org_id)
    .eq('status', 'ACTIVE')
  
  for (const fee of defaultFees) {
    await supabase.from('student_fees').insert({
      student_id: student.id,
      fee_type_id: fee.id,
      amount_due: fee.amount_naira
    })
  }
  ```

**Bulk Import Endpoint (1.5 hours)**
- [ ] POST /api/students/bulk-import (CSV upload)
- [ ] Parse CSV (email, matric_number, first_name, last_name, department)
- [ ] Bulk insert students
- [ ] Bulk create virtual accounts
- [ ] Return: { imported: 100, failed: 5, errors: [...] }

### Frontend Dev

**Student Dashboard Page (1.5 hours)**
- [ ] Show student list (pagination)
- [ ] Sortable by name, matric, email
- [ ] Search by name/matric
- [ ] Show virtual account for each student
- [ ] Copy-to-clipboard for account number

**Create Student Form (1.5 hours)**
- [ ] Form fields: email, matric, name, department
- [ ] Form validation (required fields)
- [ ] On submit: POST /api/students
- [ ] Show loading state
- [ ] Show error message if creation fails
- [ ] Redirect to student detail on success

**Bulk Import UI (1 hour)**
- [ ] File upload field
- [ ] Show CSV template download
- [ ] On upload: POST /api/students/bulk-import
- [ ] Show progress bar
- [ ] Show results: X imported, Y failed

**Student Detail Page (1 hour)**
- [ ] Show all student info
- [ ] Show virtual account (large, easy to copy)
- [ ] Show assigned fees (with amounts)
- [ ] Show payment history (empty for now)

### Test Coverage

**API Tests:**
```bash
# Create student
curl -X POST http://localhost:3001/api/students \
  -H "Authorization: Bearer ${token}" \
  -d '{"email": "test@student.oau.edu.ng", "matric_number": "CSC/2024/001", "first_name": "Test", "last_name": "Student", "department": "Computer Science"}'

# Verify virtual account created in database
SELECT * FROM virtual_accounts WHERE student_id = ?;
```

**Manual Testing:**
- [ ] Create student via UI → Virtual account shown
- [ ] Copy account number → Can paste elsewhere
- [ ] Bulk import CSV → All students created
- [ ] List students → All shown with accounts

---

## Day 4: Fees & Webhooks (July 1)

### Objectives
- [ ] Fee templates can be created
- [ ] Nomba webhook handler working
- [ ] Payments reconciled automatically
- [ ] Email receipts sent

### Backend Dev + Emerald

**Create Fee Type Endpoint (1 hour)**
- [ ] POST /api/fee-types:
  ```typescript
  export async function POST(req) {
    const { name, amount_naira, is_clearance_required } = await req.json()
    
    const { data, error } = await supabase
      .from('fee_types')
      .insert({
        org_id: req.user.org_id,
        name, amount_naira, is_clearance_required, status: 'ACTIVE'
      })
      .select()
      .single()
    
    // Auto-assign to all ACTIVE students
    const students = await supabase
      .from('students')
      .select('id')
      .eq('org_id', req.user.org_id)
      .eq('status', 'ACTIVE')
    
    for (const student of students) {
      await supabase.from('student_fees').insert({
        student_id: student.id,
        fee_type_id: data.id,
        amount_due: amount_naira
      })
    }
    
    return Response.json(data, { status: 201 })
  }
  ```

**Nomba Webhook Handler (3 hours)**
- [ ] POST /api/webhooks/nomba:
  - [ ] Validate HMAC signature
  - [ ] Check for duplicate transaction
  - [ ] Find student by account number
  - [ ] Find outstanding fees
  - [ ] Allocate payment (reconcile)
  - [ ] Update fee statuses
  - [ ] Recalculate clearance
  - [ ] Generate receipt PDF
  - [ ] Queue email send
  - [ ] Create audit log
  - [ ] Return 200 OK
- [ ] Follow RECONCILIATION_FLOW.md step-by-step

**Email Service (1.5 hours)**
- [ ] Install SendGrid:
  ```bash
  npm install @sendgrid/mail
  ```
- [ ] Create email helper:
  ```typescript
  // lib/email.ts
  import sgMail from '@sendgrid/mail'
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  
  export async function sendReceipt(email, receiptHtml) {
    await sgMail.send({
      to: email,
      from: 'noreply@feeflow.io',
      subject: 'Payment Receipt – FeeFlow',
      html: receiptHtml
    })
  }
  ```
- [ ] Generate receipt PDF using HTML-to-PDF library:
  ```bash
  npm install puppeteer  # or similar
  ```
- [ ] Send email after payment reconciled

**Deploy Webhook URL (0.5 hour)**
- [ ] Deploy backend to production (Railway/Vercel)
- [ ] Get webhook URL: https://api.feeflow.vercel.app/api/webhooks/nomba
- [ ] Submit to Nomba via form (link in DEPLOYMENT.md)
- [ ] Test webhook delivery

### Frontend Dev

**Fee Management Page (1.5 hours)**
- [ ] List all fee types (name, amount, clearance-required flag)
- [ ] Create new fee button
- [ ] Create fee form:
  - [ ] Name, amount, description, is_clearance_required checkbox
  - [ ] On submit: POST /api/fee-types
  - [ ] Show success message
  - [ ] Refresh list

**Payment History (0.5 hour)**
- [ ] Create payment display component (will populate later)
- [ ] Stub data for now

### Test Coverage

**Webhook Testing (Critical):**
```bash
# 1. Deploy backend
vercel deploy

# 2. Register webhook with Nomba (via form)

# 3. Send test payment via Nomba sandbox
# (Nomba provides sandbox credentials)

# 4. Verify webhook received
curl http://localhost:3001/api/webhooks/nomba (test locally with curl)

# 5. Check database
SELECT * FROM payments WHERE student_id = ?;
SELECT * FROM student_fees WHERE student_id = ?;
```

**Email Testing:**
```typescript
// Log email calls (don't actually send)
if (process.env.NODE_ENV === 'development') {
  console.log('Email would be sent to:', email)
}
```

---

## Day 5: Clearance & Dashboard (July 2)

### Objectives
- [ ] Clearance calculation working
- [ ] Student dashboard shows accurate status
- [ ] Admin dashboard shows metrics
- [ ] Debtors list available

### Backend Dev + Emerald

**Clearance Calculation (1.5 hours)**
- [ ] Implement clearance function (from RECONCILIATION_FLOW.md):
  ```sql
  CREATE OR REPLACE FUNCTION calculate_clearance(p_student_id UUID)
  RETURNS TABLE (is_cleared BOOLEAN) AS $$
  BEGIN
    -- Logic: all required fees must be PAID
  END;
  $$ LANGUAGE plpgsql;
  ```
- [ ] Endpoint: GET /api/clearance/:student_id
- [ ] Returns: { is_cleared, cleared_at, required_fees, optional_fees }

**Clearance Recalculation Trigger (1 hour)**
- [ ] After payment reconciliation, call calculate_clearance
- [ ] After fee status changes, recalculate
- [ ] Store result in clearance_status table (denormalized for speed)

**Admin Endpoints (1 hour)**
- [ ] GET /api/clearance (get all students' status)
- [ ] GET /api/debtors (students owing money, sorted by amount)
- [ ] Response includes: matric, name, amount_owed, oldest_fee_days_overdue

**Receipts & Certificates (1 hour)**
- [ ] Generate clearance certificate PDF on-demand
- [ ] Endpoint: GET /api/clearance/:student_id/certificate
- [ ] Return PDF for download

### Frontend Dev

**Student Dashboard (2 hours)**
- [ ] Show:
  - [ ] Virtual account (prominent, copy button)
  - [ ] Fees table (amount due, paid, balance, status)
  - [ ] Payment history (date, amount, status)
  - [ ] Clearance status (CLEARED or NOT CLEARED)
  - [ ] If cleared: Download certificate button
  - [ ] Progress bar: X/Y fees paid

**Admin Dashboard (1.5 hours)**
- [ ] Summary metrics:
  - [ ] Total revenue (₦X)
  - [ ] Students cleared (X/500)
  - [ ] Outstanding (₦X)
  - [ ] Collection rate (95%)
- [ ] Recent transactions (last 10)
- [ ] Debtors list (top 20 owing money)
- [ ] Quick links to key pages

**Debtors Page (1 hour)**
- [ ] List all students owing money
- [ ] Sortable: by name, matric, amount owed
- [ ] Show: matric, name, amount owed, oldest fee
- [ ] Pagination (20 per page)
- [ ] Export to CSV button

### Test Coverage

**Manual Testing:**
- [ ] Create student, assign fees (₦5K)
- [ ] Receive ₦5K payment
- [ ] Verify fees marked PAID
- [ ] Check clearance: is_cleared = true (if all required fees paid)
- [ ] Student dashboard shows CLEARED
- [ ] Can download certificate

---

## Day 6: Reports & Polish (July 3)

### Objectives
- [ ] Reports (CSV export) working
- [ ] UI polished
- [ ] Error states handled
- [ ] Accessibility improved

### Backend Dev

**Reports Endpoints (1.5 hours)**
- [ ] GET /api/reports/collection (revenue by fee, by department)
- [ ] GET /api/reports/students (all students with balances)
- [ ] Support format parameter: ?format=JSON or ?format=CSV
- [ ] Return CSV file for download

### Frontend Dev

**Reports Page (1.5 hours)**
- [ ] Show collection summary
- [ ] Revenue by fee type (table + chart)
- [ ] Export buttons (CSV, PDF)
- [ ] Date range filter (optional)

**UI Polish (2 hours)**
- [ ] Error boundaries on all pages
- [ ] Loading spinners on data fetches
- [ ] Empty states (no data shown)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Dark mode support (optional, nice-to-have)
- [ ] Accessibility:
  - [ ] Alt text on images
  - [ ] Keyboard navigation
  - [ ] Color contrast (WCAG AA)
  - [ ] Form labels for screen readers

**Copy & Paste UX (1 hour)**
- [ ] Account numbers copy-to-clipboard
- [ ] Show "Copied!" toast message
- [ ] Keyboard shortcut info

### Emerald

**Landing Page (2-3 hours)**
- [ ] Design & build hero section
- [ ] Problem/solution overview
- [ ] Feature highlights (screenshots/demo video)
- [ ] Call-to-action: "See Live Demo"
- [ ] Tech stack section
- [ ] Deployment: Vercel (same project as app)

**Documentation Polish (1 hour)**
- [ ] Update README with live links
- [ ] API documentation (or link to OpenAPI)
- [ ] Demo account credentials

### Test Coverage

**Manual Testing:**
- [ ] Generate report → CSV downloads correctly
- [ ] Error scenario (no data) → Empty state shown
- [ ] Keyboard navigation → Tab through form fields
- [ ] Mobile view → Responsive layout works
- [ ] Copy account number → Toast appears

---

## Day 7: Testing & Submission (July 4-7)

### Objectives
- [ ] All edge cases tested
- [ ] Load testing passed
- [ ] Demo script rehearsed
- [ ] Production deployment successful
- [ ] Judges have everything needed

### All Team

**E2E Testing (3 hours - Emerald)**
- [ ] Walk through complete flow:
  1. Create institution
  2. Import students (100+)
  3. Create fees
  4. Receive payment (via Nomba sandbox)
  5. Verify reconciliation
  6. Check clearance
  7. Download receipt & certificate
  8. Export reports
- [ ] Test edge cases from EDGE_CASES.md:
  - [ ] Duplicate payment
  - [ ] Overpayment
  - [ ] Underpayment
  - [ ] Misdirected payment
  - [ ] Concurrent payments
- [ ] Document any bugs found

**Load Testing (1 hour - Backend Dev)**
- [ ] Simulate 100 concurrent users
- [ ] Simulate 10 payments/second
- [ ] Tools: k6, Apache JMeter, or similar
- [ ] Check:
  - [ ] Response time < 1 second
  - [ ] No database errors
  - [ ] No connection pool exhaustion

**UI/UX Testing (1 hour - Frontend Dev)**
- [ ] Test all user journeys:
  - [ ] Student login → view dashboard
  - [ ] Admin create student → assign fees
  - [ ] View payment history
  - [ ] Generate reports
- [ ] Test error cases:
  - [ ] Invalid login
  - [ ] Network error
  - [ ] Database timeout

**Security Review (1 hour - Emerald)**
- [ ] Check:
  - [ ] No API keys in code/logs
  - [ ] HTTPS enforced
  - [ ] Webhook signature validated
  - [ ] RLS policies working
  - [ ] SQL injection tests pass
  - [ ] XSS protection enabled

### Production Deployment (July 7)

**Before Submission (By 10 PM WAT):**

1. **Code Freeze**
   ```bash
   git tag v1.0.0-final
   git push origin v1.0.0-final
   ```

2. **Merge to Main**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```

3. **Vercel Auto-Deploy**
   - Watch: https://vercel.com/feeflow
   - Should complete in 2-5 minutes
   - Verify: https://feeflow.vercel.app loads

4. **Smoke Test**
   ```bash
   # 1. Health check
   curl https://feeflow.vercel.app/api/health
   
   # 2. Login test
   # Open https://feeflow.vercel.app
   # Login with test credentials
   
   # 3. Payment test
   # Send Nomba sandbox payment
   # Verify webhook received
   # Check database
   ```

5. **Seed Demo Data**
   ```bash
   npm run seed:production
   # Creates: 1 institution (OAU), 5 fee types, 200 students
   ```

6. **Register Webhook**
   - Submit to Nomba form (link in DEPLOYMENT.md)
   - Confirm webhook URL accepted

7. **Final Verification**
   - [ ] Frontend loads
   - [ ] Login works
   - [ ] Database queries work
   - [ ] Emails send
   - [ ] No errors in Sentry

### Documentation Completion

**By Submission (July 7, 11 PM):**

- [ ] README.md updated with:
  - Live demo link
  - Test credentials
  - API docs link
  - Architecture overview
  - How to deploy
  
- [ ] API Documentation
  - Postman collection (or OpenAPI spec)
  - Endpoint documentation
  - Error codes explained

- [ ] Pitch Deck (5-10 slides)
  - Problem (manual fee collection)
  - Solution (FeeFlow)
  - Architecture diagram
  - Demo screenshots
  - Why it wins (reconciliation accuracy)
  - Roadmap

- [ ] Demo Video (3-5 min)
  - Screen recording of key features
  - MP4 format
  - Audio walkthrough

### Demo Script Rehearsal

**Before Demo Day:**

```markdown
# FeeFlow Demo Script (5 minutes)

## Intro (30 sec)
"FeeFlow is automatic fee reconciliation infrastructure 
for Nigerian educational institutions. Every student 
gets a unique virtual account, and payments reconcile 
instantly—no manual verification needed."

## Problem (1 min)
"Universities currently handle fees manually. Students 
send screenshots, treasurers verify by hand, disputes 
happen, and data is fragmented. Our OAU demo has 500 
students and ₦50M in annual fees. Manual reconciliation 
would take weeks."

## Solution Demo (2 min)
[Live Demo]
1. Show student dashboard
   - Virtual account: 1023456789
   - Fees owed: ₦7,500
   - "Pay this account"

2. Simulate payment via Nomba
   - Send ₦7,500 to account
   - Webhook arrives in < 1 second

3. Show student dashboard update
   - Fees now PAID ✅
   - Clearance status: CLEARED ✅
   - Receipt: [show PDF]

4. Show admin dashboard
   - Revenue: ₦50M
   - Cleared: 450/500 (90%)
   - Collections rate: 95%

## Why It Wins (1 min)
- Reconciliation accuracy: ACID transactions, no race conditions
- Identity model: Student ↔ account 1:1 mapping, zero confusion
- Developer API: Other institutions can integrate easily
- Real problem: 500+ Nigerian institutions need this

## Q&A
(Questions from judges)
```

### Submission Checklist

**72 Hours Before Deadline:**
- [ ] All code merged to main
- [ ] All tests passing
- [ ] Production deployed
- [ ] Demo rehearsed
- [ ] Slides finalized

**24 Hours Before Deadline:**
- [ ] Final smoke test
- [ ] Backup demo video recorded
- [ ] All URLs verified
- [ ] Judges' email draft ready

**1 Hour Before Deadline:**
- [ ] System status: all green
- [ ] Slack message drafted (post-submission)
- [ ] Contact info ready for judges

**After Submission:**
- [ ] Send judges: live link + test credentials
- [ ] Slack: "#feeflow-build SUBMITTED! 🎉"
- [ ] Archive all credentials
- [ ] Document lessons learned
- [ ] Plan post-hackathon roadmap

---

## Daily Standup Format (9 AM WAT)

**Each person reports:**
1. ✅ What I completed yesterday
2. 🚧 What I'm working on today
3. 🚧 Blockers (if any)

**Example:**
```
Emerald:
✅ Webhook endpoint working, payments reconciling
🚧 Building clearance calculation today
❌ No blockers

Frontend Dev:
✅ Student dashboard UI complete
🚧 Integrating with clearance API
❌ Waiting for clearance endpoint (will complete today)

Backend Dev:
✅ Fee creation endpoint working
🚧 Reports endpoint (CSV export)
❌ No blockers
```

**If blocker:** Get help immediately, don't wait until next day.

---

**Good luck! You've got this. 🚀**