# Deployment: FeeFlow

**Version:** 1.0  
**Last Updated:** June 27, 2026  
**Target:** Production deployment by July 7, 2026, 11:59 PM WAT

---

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Development Workflow](#development-workflow)
3. [Staging Deployment](#staging-deployment)
4. [Production Deployment](#production-deployment)
5. [Post-Deployment](#post-deployment)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Submission Day Checklist](#submission-day-checklist)

---

## Environment Setup

### Local Development

**Prerequisites:**
```bash
node --version          # v18 or higher
npm --version           # v9 or higher
git --version           # v2.40 or higher
docker --version        # For local Supabase (optional)
```

**Clone Repository:**
```bash
git clone https://github.com/feeflow/feeflow.git
cd feeflow
npm install
```

**Create `.env.local` (Frontend):**
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
NEXT_PUBLIC_API_URL=http://localhost:3001

# For development (not production)
NEXT_PUBLIC_ENVIRONMENT=development
```

**Create `.env` (Backend):**
```bash
# .env
DATABASE_URL=postgresql://[user]:[password]@localhost:5432/feeflow
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_KEY=[your-service-key]
SUPABASE_ANON_KEY=[your-anon-key]

# Nomba (TEST credentials)
NOMBA_CLIENT_ID_TEST=706df6c4-b8bb-4130-88c4-d21b052f8631
NOMBA_PRIVATE_KEY_TEST=k8UobYk3APgOoxUnNL7VpuxzwTsH4LsXtydfjcHs8RH0YISBB4OMqJsaafG+U8fWETu9YZ96bNXE+DelCDuMPw==
NOMBA_ENVIRONMENT=TEST

# Email
SENDGRID_API_KEY=[your-sendgrid-key]

# JWT
JWT_SECRET=your-super-secret-key-change-in-production

# Webhook
NOMBA_WEBHOOK_SECRET=[secret-for-validating-webhooks]

PORT=3001
NODE_ENV=development
```

**Start Development Servers:**
```bash
# Terminal 1: Frontend
cd apps/frontend
npm run dev
# Runs on http://localhost:3000

# Terminal 2: Backend (if separate)
cd apps/backend
npm run dev
# Runs on http://localhost:3001
```

**Verify Setup:**
```bash
# Open browser
curl http://localhost:3000           # Frontend running?
curl http://localhost:3001/health    # Backend running?
```

---

## Development Workflow

### Git Workflow

**Branch Strategy:**
```
main
  └─ (production, tagged with versions)

develop
  └─ (integration, where features merge)
  
feature/emerald/[name]
feature/frontend/[name]
feature/backend/[name]
  └─ (individual features, merge to develop via PR)
```

**Daily Workflow:**
```bash
# Start of day
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/your-name/your-feature

# Make changes
# Commit frequently with good messages
git commit -m "feat: add student creation endpoint"

# Push to GitHub
git push origin feature/your-name/your-feature

# Create Pull Request (on GitHub)
# - Add description
# - Request review (Emerald or team)
# - Wait for approval

# After approval, merge to develop
# - Vercel auto-deploys to staging.feeflow.vercel.app
# - Run E2E tests on staging

# When ready for production (submission day)
# - Merge develop → main
# - Vercel auto-deploys to feeflow.vercel.app
# - Tag with version: git tag v1.0.0
```

### Code Quality Checks

**Before Committing:**
```bash
# Lint code
npm run lint

# Type check
npm run type-check

# Format code
npm run format

# Run tests
npm run test

# Build
npm run build
```

**Git Hooks (Pre-commit):**
```bash
# Install husky
npm install husky --save-dev
npx husky install

# Add pre-commit hook
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
npm run lint
npm run type-check
EOF

chmod +x .husky/pre-commit
```

---

## Staging Deployment

### Deploy to Staging (Before Production)

**Automatic (on PR):**
```
1. Push to feature branch
2. Create PR to develop
3. GitHub Actions trigger
   - Lint & type check
   - Run tests
   - Build artifact
4. Merge to develop
5. GitHub Actions trigger
   - Deploy to staging.feeflow.vercel.app
   - Deploy backend to staging-api.railway.app
```

**Manual Staging Deploy:**
```bash
# If automatic fails, deploy manually

# Frontend
vercel --prod --target staging

# Backend (if separate)
railway deploy --environment staging
```

**Verify Staging:**
```bash
# Check frontend
curl https://staging.feeflow.vercel.app

# Check backend health
curl https://staging-api.railway.app/health

# Run E2E tests against staging
npm run test:e2e -- --base-url https://staging.feeflow.vercel.app

# Smoke tests
- Login with test email
- Create test student
- View virtual account
- Submit test payment via Nomba sandbox
- Verify reconciliation
- Check receipt generation
```

### Environment Variables (Staging)

**Staging uses TEST Nomba credentials:**

Set in Vercel/Railway dashboard:
```
NOMBA_CLIENT_ID=706df6c4-b8bb-4130-88c4-d21b052f8631
NOMBA_PRIVATE_KEY=k8UobYk3APgOoxUnNL7VpuxzwTsH4LsXtydfjcHs8RH0YISBB4OMqJsaafG+U8fWETu9YZ96bNXE+DelCDuMPw==
NOMBA_ENVIRONMENT=TEST

SUPABASE_URL=https://[staging-project].supabase.co
DATABASE_URL=postgresql://[staging-credentials]

SENDGRID_API_KEY=[production-sendgrid-key]
JWT_SECRET=[staging-secret]
```

---

## Production Deployment

### Prerequisites

**48 Hours Before Submission:**

1. **Supabase Production Project**
   - Log in: https://app.supabase.com
   - Create new project (if not done)
   - Note: Project URL, Anon Key, Service Key
   - Create database schema (run migrations)

2. **Vercel Production Project**
   - Log in: https://vercel.com
   - Connect GitHub repo
   - Configure environment variables
   - Set Node version: 18+

3. **Railway Production Project**
   - Log in: https://railway.app
   - Create new project
   - Connect GitHub repo (if using Railway for backend)

4. **Nomba Production Credentials**
   - Switch from TEST to LIVE credentials
   - Update API keys in environment
   - Register webhook URL with Nomba (via form)

5. **SendGrid Production Account**
   - Verify sender domain
   - Test email delivery

### Deploy to Production

**On Submission Day (before 11:59 PM WAT):**

```bash
# 1. Final checks
npm run test                    # All tests passing?
npm run build                   # Build succeeds?
npm run lint                    # No linting errors?

# 2. Update credentials
# Edit .env with LIVE Nomba credentials
NOMBA_CLIENT_ID_LIVE=e5e85b13-f560-4643-814e-c87435dbbc15
NOMBA_PRIVATE_KEY_LIVE=8/doS7Q3w77EANpk3vpgSrc05hhOiRWp3eBs01sXyZ1AmovtZUXlmrxie+xnEF2tR4q79t0IFufMD1d4JrkT8g==
NOMBA_ENVIRONMENT=LIVE

# 3. Merge to main
git checkout main
git pull origin develop
git merge develop
git tag v1.0.0
git push origin main --tags

# 4. Vercel auto-deploys
# Watch: https://vercel.com/feeflow/feeflow/deployments
# Wait for: ✓ Production deployment successful

# 5. Railway auto-deploys (if backend on Railway)
# Watch: https://railway.app/[project]/deployments
# Wait for: ✓ Deployment successful

# 6. Verify production
curl https://feeflow.vercel.app/api/health
# Should respond: { "status": "ok" }
```

### Environment Variables (Production)

**Set in Vercel Dashboard:**

```
# Nomba (LIVE credentials)
NOMBA_CLIENT_ID=e5e85b13-f560-4643-814e-c87435dbbc15
NOMBA_PRIVATE_KEY=8/doS7Q3w77EANpk3vpgSrc05hhOiRWp3eBs01sXyZ1AmovtZUXlmrxie+xnEF2tR4q79t0IFufMD1d4JrkT8g==
NOMBA_ENVIRONMENT=LIVE
NOMBA_WEBHOOK_SECRET=[secret-from-nomba-form]

# Supabase
SUPABASE_URL=https://[production-project].supabase.co
SUPABASE_SERVICE_KEY=[production-service-key]
SUPABASE_ANON_KEY=[production-anon-key]

# Database (connection pooling enabled)
DATABASE_URL=postgresql://[production-user]:[password]@[project].supabase.co:6543/postgres?sslmode=require&pgbouncer=true

# Email
SENDGRID_API_KEY=[production-sendgrid-key]

# Security
JWT_SECRET=[production-secret-change-from-staging]
WEBHOOK_SECRET=[production-webhook-secret]

# Environment
NODE_ENV=production
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_API_URL=https://api.feeflow.vercel.app
```

---

## Post-Deployment

### Smoke Tests

**Immediately after deployment:**

```bash
# 1. Check system health
curl https://feeflow.vercel.app/api/health
# Expected: { "status": "ok", "timestamp": "2026-07-07T23:00:00Z" }

# 2. Test login flow
# - Open https://feeflow.vercel.app
# - Click "Login"
# - Enter test email: test@student.oau.edu.ng
# - Receive OTP email
# - Enter OTP
# - Should redirect to dashboard

# 3. Test payment flow (using Nomba TEST account, but with real credentials)
# - Create test student in dashboard
# - Note virtual account number
# - Send test payment via Nomba API
# - Verify webhook received
# - Verify fees updated
# - Verify receipt emailed

# 4. Check monitoring
# - Vercel Analytics: https://vercel.com/feeflow/feeflow
# - No errors in logs
# - Uptime showing green
```

### Initial Data Setup

**Populate with demo data:**

```bash
# Run seed script
npm run seed:production

# This creates:
# - 1 institution (OAU)
# - 5 fee types (Faculty Due, Lab Fee, Clearance Fee, etc.)
# - 200 test students with virtual accounts
# - Ready for judges to test
```

### Register Webhook with Nomba

**Critical: Without this, payments won't be received**

```bash
# Submit webhook URL to Nomba via form:
# https://forms.gle/hKfBRHZiTGvU7LC59

# Fill:
# - Webhook URL: https://api.feeflow.vercel.app/api/webhooks/nomba
# - Sub-account ID: f23a4cd9-4d9b-4429-92f4-6f881d9c39b2
# - API Key: (your LIVE key)

# After submission:
# - Nomba will confirm via email
# - Start sending webhooks to your URL
# - Test with sandbox payment
```

---

## Rollback Procedures

### If Production Breaks

**Immediate Action (within first minute):**

```bash
# 1. Identify issue
# - Check Vercel logs: https://vercel.com/feeflow/feeflow/logs
# - Check database: https://app.supabase.com
# - Check error tracking: Sentry dashboard

# 2. Rollback to previous version
# Option A: Revert git commit
git revert [bad-commit-hash]
git push origin main
# Vercel auto-redeploys previous version

# Option B: Use Vercel rollback UI
# - https://vercel.com/feeflow/feeflow/deployments
# - Click on previous working deployment
# - Click "Rollback to this Deployment"
# - Confirm

# 3. Notify team
# - Slack: "Production rolled back to [version]"
# - Explain issue found
# - Plan fix

# 4. Fix issue locally
git checkout develop
git pull origin develop
git checkout -b feature/[name]/fix-issue
# ... fix code ...
git commit -m "fix: [description]"
git push origin feature/[name]/fix-issue
# Create PR, merge to develop, test on staging, then main
```

**Example Rollback:**
```bash
# If v1.0.0 is broken
git log --oneline | head -5
# abc1234 (HEAD -> main) v1.0.0: Fix payment webhook
# def5678 v0.9.9: Add clearance calculation
# ghi9012 v0.9.8: Refactor database

# Rollback to v0.9.9
git reset --hard def5678
git push origin main --force
# Vercel sees main changed, re-deploys previous code

# (Or use Vercel UI for safer one-click rollback)
```

---

## Monitoring & Alerts

### Tools Setup

**Vercel Analytics:**
- Automatic (no setup needed)
- URL: https://vercel.com/feeflow/feeflow/analytics
- Monitors: Uptime, response time, errors

**Sentry (Error Tracking):**
```bash
# Install
npm install @sentry/nextjs

# Configure (in app initialization)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0
});
```

**Supabase Logs:**
- URL: https://app.supabase.com/project/[project]/logs
- Monitor: Database queries, errors, slow queries

**SendGrid Analytics:**
- URL: https://app.sendgrid.com/analytics
- Monitor: Email delivery, bounces, opens

### Alert Configuration

**Set up alerts for:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| API Response Time | > 5 seconds | Check Vercel/database |
| Error Rate | > 1% | Check Sentry for stack traces |
| Database CPU | > 80% | Check for slow queries |
| Email Bounce | > 5% | Check SendGrid logs |
| Payment Webhook Latency | > 10 seconds | Check webhook logs |

**Alert Destinations:**
- Slack channel: #feeflow-alerts
- Email: Emerald + team

---

## Submission Day Checklist

### Final 24 Hours Before Deadline

**[ ] 24 Hours Before (July 6, 11:59 PM WAT)**
- [ ] All code merged to `develop`
- [ ] All tests passing on staging
- [ ] Demo script rehearsed
- [ ] Slide deck finalized
- [ ] Landing page updated with live links

**[ ] 12 Hours Before (July 7, 12:00 PM WAT)**
- [ ] Merge `develop` → `main`
- [ ] Tag version: `git tag v1.0.0-submission`
- [ ] Vercel deploys to production
- [ ] Smoke tests pass
- [ ] Webhook registered with Nomba
- [ ] SendGrid emails working
- [ ] Sentry monitoring active

**[ ] 6 Hours Before (July 7, 6:00 PM WAT)**
- [ ] Final production smoke test
- [ ] Demo data seeded (200 students, 5 fee types)
- [ ] Load test (simulate 100 concurrent users, 10 payments/sec)
- [ ] Backup demo video recorded (in case live demo fails)
- [ ] Pitch deck ready (5-min talk, 10-min Q&A)

**[ ] 2 Hours Before (July 7, 10:00 PM WAT)**
- [ ] All systems green
- [ ] API docs published (https://feeflow.vercel.app/api-docs)
- [ ] README updated on GitHub
- [ ] Judges' email ready with: demo link + live credentials
- [ ] Slack/Discord setup for post-submission messages

**[ ] 30 Minutes Before Deadline (July 7, 11:30 PM WAT)**
- [ ] Final health check
  ```bash
  curl https://feeflow.vercel.app/api/health
  ```
- [ ] Test payment flow end-to-end
- [ ] Verify receipts being emailed
- [ ] Check error logs (no critical errors)
- [ ] Confirm judges have access to demo account

### Submission Format

**Required files:**
1. **README.md** (GitHub repository root)
   - Overview of project
   - How to access live demo
   - Test credentials
   - Technical architecture summary

2. **API Documentation**
   - Accessible at: https://feeflow.vercel.app/api-docs
   - Or: Postman collection

3. **Live Demo**
   - URL: https://feeflow.vercel.app
   - Test account credentials
   - Sample institution (OAU) pre-populated

4. **Video Demo** (backup)
   - 5-minute walkthrough of core features
   - MP4, < 100MB
   - Uploaded to GitHub or shared drive

5. **Pitch Deck** (optional but recommended)
   - 5-10 slides
   - Problem, solution, architecture, roadmap
   - Why it wins on judging criteria

### Post-Submission

**After 11:59 PM WAT (July 7):**
- [ ] Notify Nomba & DevCareer (submission complete)
- [ ] Archive all credentials securely (password manager)
- [ ] Document any known issues in GitHub Issues
- [ ] Add post-hackathon todos to backlog
- [ ] Thank the team! 🎉

---

**Deployment complete. System ready for demo day. Good luck!**