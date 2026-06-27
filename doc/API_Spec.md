# API Specification: FeeFlow

**Version:** 1.0  
**Base URL:** `https://api.feeflow.vercel.app` (production) or `http://localhost:3001` (dev)  
**Authentication:** JWT Bearer token (from Supabase Auth)  
**Content-Type:** `application/json`

---

## Authentication

### Login (Email + OTP)

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "chioma.adeyemi@student.oau.edu.ng"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "OTP sent to email"
}
```

**Error Responses:**
- `400 Bad Request`: Missing email
- `429 Too Many Requests`: Too many OTP requests

---

### Verify OTP

**Endpoint:** `POST /api/auth/verify-otp`

**Request:**
```json
{
  "email": "chioma.adeyemi@student.oau.edu.ng",
  "otp": "123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-45",
    "email": "chioma.adeyemi@student.oau.edu.ng",
    "org_id": "org-001",
    "role": "STUDENT"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid/expired OTP
- `401 Unauthorized`: Email not found

---

### Logout

**Endpoint:** `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer ${token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Institutions

### Create Institution

**Endpoint:** `POST /api/institutions`

**Role:** Super Admin only

**Request:**
```json
{
  "name": "Obafemi Awolowo University",
  "slug": "oau",
  "nomba_account_id": "f666ef9b-888e-4799-85ce-acb505b28023",
  "nomba_sub_account_id": "f23a4cd9-4d9b-4429-92f4-6f881d9c39b2",
  "admin_email": "admin@oau.edu.ng",
  "institution_type": "UNIVERSITY",
  "country_code": "NG"
}
```

**Response (201 Created):**
```json
{
  "id": "org-001",
  "name": "Obafemi Awolowo University",
  "slug": "oau",
  "status": "ACTIVE",
  "created_at": "2026-07-01T10:00:00Z"
}
```

---

### Get Institution

**Endpoint:** `GET /api/institutions/:id`

**Headers:**
```
Authorization: Bearer ${token}
```

**Response (200 OK):**
```json
{
  "id": "org-001",
  "name": "Obafemi Awolowo University",
  "slug": "oau",
  "logo_url": "https://s3.../oau-logo.png",
  "status": "ACTIVE",
  "nomba_account_id": "f666ef9b-888e-4799-85ce-acb505b28023",
  "created_at": "2026-07-01T10:00:00Z"
}
```

---

## Students

### Create Student

**Endpoint:** `POST /api/students`

**Headers:**
```
Authorization: Bearer ${token}
```

**Request:**
```json
{
  "email": "chioma.adeyemi@student.oau.edu.ng",
  "matric_number": "CSC/2024/045",
  "first_name": "Chioma",
  "last_name": "Adeyemi",
  "department": "Computer Science",
  "faculty": "Computing"
}
```

**Response (201 Created):**
```json
{
  "id": "student-45",
  "email": "chioma.adeyemi@student.oau.edu.ng",
  "matric_number": "CSC/2024/045",
  "first_name": "Chioma",
  "last_name": "Adeyemi",
  "status": "ACTIVE",
  "virtual_account": {
    "id": "va-45",
    "account_number": "1023456789",
    "bank_name": "Nomba",
    "status": "ACTIVE"
  },
  "created_at": "2026-07-01T10:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields
- `409 Conflict`: Email or matric already exists for this org

---

### List Students

**Endpoint:** `GET /api/students`

**Query Parameters:**
```
?status=ACTIVE&department=Computer%20Science&limit=20&offset=0
```

**Headers:**
```
Authorization: Bearer ${token}
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "student-45",
      "email": "chioma.adeyemi@student.oau.edu.ng",
      "matric_number": "CSC/2024/045",
      "first_name": "Chioma",
      "status": "ACTIVE",
      "created_at": "2026-07-01T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 500,
    "limit": 20,
    "offset": 0
  }
}
```

---

### Get Student

**Endpoint:** `GET /api/students/:id`

**Headers:**
```
Authorization: Bearer ${token}
```

**Response (200 OK):**
```json
{
  "id": "student-45",
  "email": "chioma.adeyemi@student.oau.edu.ng",
  "matric_number": "CSC/2024/045",
  "first_name": "Chioma",
  "last_name": "Adeyemi",
  "department": "Computer Science",
  "status": "ACTIVE",
  "credit_balance": 0,
  "virtual_account": {
    "account_number": "1023456789",
    "bank_name": "Nomba",
    "status": "ACTIVE"
  },
  "fees": [
    {
      "id": "sf-45-001",
      "fee_type": "Faculty Due",
      "amount_due": 500000,
      "amount_paid": 300000,
      "amount_balance": 200000,
      "status": "PARTIALLY_PAID"
    }
  ],
  "clearance_status": {
    "is_cleared": false,
    "last_calculated_at": "2026-07-01T14:30:00Z"
  }
}
```

---

### Update Student

**Endpoint:** `PATCH /api/students/:id`

**Headers:**
```
Authorization: Bearer ${token}
```

**Request:**
```json
{
  "status": "DEFERRED",
  "date_deferred": "2026-07-01"
}
```

**Response (200 OK):**
```json
{
  "id": "student-45",
  "status": "DEFERRED",
  "date_deferred": "2026-07-01",
  "updated_at": "2026-07-01T15:00:00Z"
}
```

---

### Bulk Import Students

**Endpoint:** `POST /api/students/bulk-import`

**Headers:**
```
Authorization: Bearer ${token}
Content-Type: multipart/form-data
```

**Body:**
```
file: <CSV file>
```

**CSV Format:**
```
email,matric_number,first_name,last_name,department
chioma@student.oau.edu.ng,CSC/2024/045,Chioma,Adeyemi,Computer Science
adebayo@student.oau.edu.ng,CSC/2024/087,Adebayo,Oluwumi,Computer Science
```

**Response (200 OK):**
```json
{
  "success": true,
  "imported": 2,
  "failed": 0,
  "message": "2 students imported successfully"
}
```

---

## Fees

### Create Fee Type

**Endpoint:** `POST /api/fee-types`

**Headers:**
```
Authorization: Bearer ${token}
```

**Request:**
```json
{
  "name": "Faculty Due",
  "amount_naira": 500000,
  "description": "Faculty development levy",
  "is_clearance_required": true,
  "fiscal_year": "2024/2025"
}
```

**Response (201 Created):**
```json
{
  "id": "ft-001",
  "org_id": "org-001",
  "name": "Faculty Due",
  "amount_naira": 500000,
  "is_clearance_required": true,
  "version": 1,
  "status": "ACTIVE",
  "created_at": "2026-07-01T10:00:00Z"
}
```

---

### List Fee Types

**Endpoint:** `GET /api/fee-types`

**Headers:**
```
Authorization: Bearer ${token}
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "ft-001",
      "name": "Faculty Due",
      "amount_naira": 500000,
      "is_clearance_required": true,
      "status": "ACTIVE"
    },
    {
      "id": "ft-002",
      "name": "Lab Fee",
      "amount_naira": 200000,
      "is_clearance_required": false,
      "status": "ACTIVE"
    }
  ]
}
```

---

### Get Student Fees

**Endpoint:** `GET /api/students/:id/fees`

**Headers:**
```
Authorization: Bearer ${token}
```

**Response (200 OK):**
```json
{
  "student_id": "student-45",
  "fees": [
    {
      "id": "sf-45-001",
      "fee_type": "Faculty Due",
      "amount_due": 500000,
      "amount_paid": 300000,
      "amount_balance": 200000,
      "status": "PARTIALLY_PAID",
      "is_clearance_required": true,
      "due_date": "2026-06-30"
    },
    {
      "id": "sf-45-002",
      "fee_type": "Lab Fee",
      "amount_due": 200000,
      "amount_paid": 0,
      "amount_balance": 200000,
      "status": "UNPAID",
      "is_clearance_required": false
    }
  ],
  "total_owed": 400000,
  "total_paid": 300000
}
```

---

## Payments

### Nomba Webhook Handler

**Endpoint:** `POST /api/webhooks/nomba`

**Headers:**
```
Content-Type: application/json
X-Nomba-Signature: <HMAC-SHA256 signature>
```

**Request:**
```json
{
  "event": "transfer.received",
  "data": {
    "amount": 750000,
    "destinationAccountNumber": "1023456789",
    "transactionReference": "TXN_ABC123XYZ",
    "senderName": "Adeyemi John",
    "senderAccount": "1234567890",
    "narration": "Payment",
    "timestamp": "2026-07-01T14:30:00Z"
  }
}
```

**Response (200 OK):**
```json
{
  "reconciled": true,
  "student_id": "student-45",
  "amount_allocated": 750000,
  "fees_updated": 3,
  "payment_id": "payment-12345",
  "clearance_status": {
    "is_cleared": true,
    "cleared_at": "2026-07-01T14:30:00Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid webhook signature
- `400 Bad Request`: Duplicate transaction ID
- `404 Not Found`: Student (virtual account) not found

---

### Get Payment History

**Endpoint:** `GET /api/payments/:student_id`

**Headers:**
```
Authorization: Bearer ${token}
```

**Query Parameters:**
```
?limit=20&offset=0&sort=created_at&order=DESC
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "payment-12345",
      "amount_naira": 750000,
      "nomba_transaction_id": "TXN_ABC123XYZ",
      "sender_name": "Adeyemi John",
      "status": "SUCCESS",
      "reconciliation_status": "RECONCILED",
      "created_at": "2026-07-01T14:30:00Z",
      "receipt_url": "https://feeflow.io/receipts/payment-12345.pdf",
      "allocations": [
        {
          "fee_type": "Faculty Due",
          "amount": 500000
        },
        {
          "fee_type": "Lab Fee",
          "amount": 200000
        },
        {
          "fee_type": "Clearance Fee",
          "amount": 50000
        }
      ]
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "offset": 0
  }
}
```

---

## Clearance

### Get Clearance Status

**Endpoint:** `GET /api/clearance/:student_id`

**Headers:**
```
Authorization: Bearer ${token}
```

**Response (200 OK):**
```json
{
  "student_id": "student-45",
  "is_cleared": true,
  "cleared_at": "2026-07-01T14:30:00Z",
  "clearance_certificate_url": "https://feeflow.io/certificates/student-45.pdf",
  "required_fees": [
    {
      "fee_type": "Faculty Due",
      "status": "PAID",
      "amount_due": 500000,
      "amount_paid": 500000
    },
    {
      "fee_type": "Clearance Fee",
      "status": "PAID",
      "amount_due": 50000,
      "amount_paid": 50000
    }
  ],
  "optional_fees": [
    {
      "fee_type": "Lab Fee",
      "status": "UNPAID",
      "amount_due": 200000,
      "amount_paid": 0
    }
  ]
}
```

---

### Get All Debtors

**Endpoint:** `GET /api/debtors`

**Headers:**
```
Authorization: Bearer ${token}
```

**Query Parameters:**
```
?department=Computer%20Science&sort=amount_owed&order=DESC&limit=50
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "student_id": "student-87",
      "matric_number": "CSC/2024/087",
      "first_name": "Adebayo",
      "last_name": "Oluwumi",
      "total_owed": 700000,
      "oldest_fee_days_overdue": 45,
      "fees": [
        {
          "fee_type": "Faculty Due",
          "amount_owed": 500000,
          "status": "PARTIALLY_PAID"
        },
        {
          "fee_type": "Lab Fee",
          "amount_owed": 200000,
          "status": "UNPAID"
        }
      ]
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 50,
    "offset": 0
  },
  "summary": {
    "total_outstanding": 10500000,
    "students_owing": 15,
    "average_debt_per_student": 700000
  }
}
```

---

## Reports

### Collection Report

**Endpoint:** `GET /api/reports/collection`

**Headers:**
```
Authorization: Bearer ${token}
```

**Query Parameters:**
```
?fiscal_year=2024/2025&department=Computer%20Science&format=JSON
```

**Response (200 OK):**
```json
{
  "report_date": "2026-07-01T15:00:00Z",
  "period": "2024/2025",
  "institution": "Obafemi Awolowo University",
  "summary": {
    "total_revenue": 50000000,
    "total_students": 500,
    "students_cleared": 450,
    "students_owing": 50,
    "collection_rate": 95.2
  },
  "by_fee_type": [
    {
      "fee_type": "Faculty Due",
      "amount_expected": 250000000,
      "amount_collected": 237500000,
      "collection_rate": 95
    },
    {
      "fee_type": "Lab Fee",
      "amount_expected": 100000000,
      "amount_collected": 95000000,
      "collection_rate": 95
    }
  ],
  "by_department": [
    {
      "department": "Computer Science",
      "students": 500,
      "collected": 47500000,
      "collection_rate": 95
    }
  ],
  "monthly_breakdown": [
    {
      "month": "2026-06",
      "collected": 2500000,
      "transactions": 150
    },
    {
      "month": "2026-07",
      "collected": 1200000,
      "transactions": 75
    }
  ]
}
```

**Download as CSV:**
```
GET /api/reports/collection?format=CSV
```

Response: CSV file attachment

---

### Student Report

**Endpoint:** `GET /api/reports/students`

**Headers:**
```
Authorization: Bearer ${token}
```

**Response (CSV format):**
```
matric_number,first_name,last_name,email,department,status,total_owed,is_cleared
CSC/2024/001,Chioma,Adeyemi,chioma@...,Computer Science,ACTIVE,0,true
CSC/2024/002,Adebayo,Oluwumi,adebayo@...,Computer Science,ACTIVE,700000,false
```

---

## Refunds

### Request Refund

**Endpoint:** `POST /api/refunds`

**Headers:**
```
Authorization: Bearer ${token}
```

**Request:**
```json
{
  "payment_id": "payment-12345",
  "amount_requested": 100000,
  "reason": "Overpayment"
}
```

**Response (201 Created):**
```json
{
  "id": "refund-001",
  "payment_id": "payment-12345",
  "amount_requested": 100000,
  "status": "REQUESTED",
  "requested_at": "2026-07-01T15:00:00Z",
  "message": "Refund request submitted. Finance officer will review."
}
```

---

### Approve Refund (Admin Only)

**Endpoint:** `PATCH /api/refunds/:id`

**Headers:**
```
Authorization: Bearer ${token}
```

**Request:**
```json
{
  "status": "APPROVED",
  "amount_approved": 100000,
  "notes": "Approved by finance officer"
}
```

**Response (200 OK):**
```json
{
  "id": "refund-001",
  "status": "APPROVED",
  "amount_approved": 100000,
  "approved_at": "2026-07-01T15:30:00Z",
  "approved_by_email": "finance@oau.edu.ng",
  "message": "Refund approved. Processing via Nomba..."
}
```

---

## Error Handling

### Standard Error Response

**Format:**
```json
{
  "success": false,
  "error": "INVALID_REQUEST",
  "message": "Email is required",
  "status_code": 400,
  "request_id": "req_12345"
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| INVALID_REQUEST | 400 | Missing/invalid fields |
| UNAUTHORIZED | 401 | No auth token or invalid token |
| FORBIDDEN | 403 | User lacks permission |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limiting

**Limits:**
- Public endpoints (login, OTP): 5 requests/minute per email
- Authenticated endpoints: 100 requests/minute per user
- Webhook endpoint: 1000 requests/minute per institution

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1656597000
```

---

**Next:** Read RECONCILIATION_FLOW.md for payment processing logic.