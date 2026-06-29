# FeeFlow Project Summary

**FeeFlow** is a multi-tenant fee management system designed for educational institutions to automate the collection, tracking, and reconciliation of student fees.

## Core Functionality
*   **Automated Payments:** Integrates with the **Nomba API** to provide each student with a unique virtual account for seamless payments.
*   **Payment Reconciliation:** Uses webhooks to automatically detect payments, allocate them to specific fee types based on priority, and update student balances in real-time.
*   **Student Clearance:** Automatically calculates and updates a student's clearance status once all required fees are paid.
*   **Notifications & Receipts:** Generates PDF receipts and sends them to students via **SendGrid** immediately after payment reconciliation.
*   **Institution Management:** Provides admins with dashboards to manage student lists, define fee types, and track collection reports.

## Technology Stack
*   **Framework:** **Next.js 14 (App Router)** for both the frontend and serverless backend (API Routes), deployed on **Vercel**.
*   **Backend-as-a-Service:** **Supabase** providing:
    *   **PostgreSQL:** For ACID-compliant financial transactions.
    *   **Row-Level Security (RLS):** To ensure strict data isolation between different institutions (multi-tenancy).
    *   **Auth:** Email + OTP authentication.
    *   **Storage:** For storing generated payment receipts.
*   **Infrastructure:**
    *   **Payments:** Nomba API (Virtual Accounts).
    *   **Communications:** SendGrid (Email).
    *   **Scheduling:** `node-cron` for background tasks like missed-webhook reconciliation.

## Architecture Highlights
*   **Serverless & Scalable:** The system is designed to handle thousands of students and institutions using a stateless, auto-scaling architecture.
*   **Security-First:** Implements HMAC-SHA256 signature verification for webhooks, HTTP-only cookies for JWTs, and a comprehensive audit trail for all financial state changes.
*   **Event-Driven:** The primary flow is driven by payment events from Nomba, triggering a chain of reconciliation, clearance updates, and notifications.
