/**
 * FeeFlow domain types.
 *
 * MONEY RULE: every monetary value is an integer in **Kobo** (the Naira minor unit).
 * ₦1 === 100 Kobo, so ₦5,000 === 500000. Never use floats for money — integer Kobo
 * arithmetic is exact and avoids rounding bugs in reconciliation.
 *
 * The DB-row interfaces below use snake_case to match the Supabase/PostgreSQL columns
 * exactly (see doc/Database_Schema.md), so a `select()` maps onto them directly.
 */

export type UUID = string;
export type ISODateTime = string;
export type ISODate = string;

/** Money in Kobo (minor unit). ₦5,000 === 500000. */
export type Kobo = number;

// ---------------------------------------------------------------------------
// Enums (string unions matching DB TEXT values)
// ---------------------------------------------------------------------------

export type OrgStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type StudentStatus = 'ACTIVE' | 'DEFERRED' | 'GRADUATED' | 'INACTIVE';
export type VirtualAccountStatus = 'ACTIVE' | 'INACTIVE';
export type FeeTypeStatus = 'ACTIVE' | 'ARCHIVED';
export type FeeStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type PaymentStatus = 'SUCCESS' | 'FAILED' | 'PENDING';
export type ReconciliationStatus = 'UNRECONCILED' | 'RECONCILED' | 'DISPUTED';
export type RefundStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PROCESSED' | 'FAILED';

export type ActorRole = 'STUDENT' | 'ADMIN' | 'FINANCE_OFFICER' | 'SUPER_ADMIN' | 'SYSTEM';
export type AuditEntityType = 'STUDENT' | 'PAYMENT' | 'STUDENT_FEE' | 'CLEARANCE' | 'SCHEMA';
export type AuditAction = 'CREATED' | 'UPDATED' | 'DELETED' | 'RECONCILED' | 'MIGRATION';

// ---------------------------------------------------------------------------
// DB row interfaces (snake_case — mirror doc/Database_Schema.md)
// ---------------------------------------------------------------------------

export interface Organization {
  id: UUID;
  name: string;
  slug: string;
  logo_url: string | null;
  nomba_account_id: string;
  nomba_sub_account_id: string;
  nomba_webhook_secret: string | null;
  institution_type: string | null;
  country_code: string;
  currency_code: string;
  admin_email: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: OrgStatus;
  is_verified: boolean;
  settings: Record<string, unknown>;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Student {
  id: UUID;
  org_id: UUID;
  email: string;
  matric_number: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  department: string | null;
  faculty: string | null;
  enrollment_year: number | null;
  level: number | null;
  phone_number: string | null;
  alternative_email: string | null;
  status: StudentStatus;
  date_enrolled: ISODate | null;
  date_deferred: ISODate | null;
  date_graduated: ISODate | null;
  /** Overpayment credit, in Kobo. */
  credit_balance: Kobo;
  metadata: Record<string, unknown>;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface VirtualAccount {
  id: UUID;
  org_id: UUID;
  student_id: UUID;
  account_number: string;
  account_name: string | null;
  bank_name: string;
  nomba_account_id: string | null;
  status: VirtualAccountStatus;
  is_primary: boolean;
  metadata: Record<string, unknown>;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  archived_at: ISODateTime | null;
}

export interface FeeType {
  id: UUID;
  org_id: UUID;
  name: string;
  slug: string | null;
  description: string | null;
  /** Fee amount in Kobo. */
  amount_naira: Kobo;
  is_clearance_required: boolean;
  fiscal_year: string | null;
  version: number;
  status: FeeTypeStatus;
  created_by_email: string | null;
  created_by_role: string | null;
  created_at: ISODateTime;
  effective_from: ISODate | null;
  effective_to: ISODate | null;
}

export interface StudentFee {
  id: UUID;
  org_id: UUID;
  student_id: UUID;
  fee_type_id: UUID;
  /** All amounts in Kobo. */
  amount_due: Kobo;
  amount_paid: Kobo;
  /** Generated column: amount_due - amount_paid. */
  amount_balance: Kobo;
  status: FeeStatus;
  due_date: ISODate | null;
  is_overdue: boolean;
  is_disputed: boolean;
  disputed_at: ISODateTime | null;
  dispute_reason: string | null;
  notes: string | null;
  created_at: ISODateTime;
  paid_at: ISODateTime | null;
}

export interface Payment {
  id: UUID;
  org_id: UUID;
  student_id: UUID;
  virtual_account_id: UUID;
  /** Amount received, in Kobo. */
  amount_naira: Kobo;
  nomba_transaction_id: string;
  nomba_reference: string | null;
  sender_name: string | null;
  sender_account: string | null;
  status: PaymentStatus;
  reconciliation_status: ReconciliationStatus;
  webhook_received_at: ISODateTime | null;
  reconciliation_completed_at: ISODateTime | null;
  is_disputed: boolean;
  dispute_reason: string | null;
  created_at: ISODateTime;
}

export interface PaymentAllocation {
  id: UUID;
  payment_id: UUID;
  student_fee_id: UUID;
  /** Allocated amount in Kobo. */
  allocated_amount: Kobo;
  created_at: ISODateTime;
}

export interface ClearanceStatusRow {
  id: UUID;
  org_id: UUID;
  student_id: UUID;
  is_cleared: boolean;
  last_calculated_at: ISODateTime;
  cleared_at: ISODateTime | null;
  calculation_details: Record<string, unknown> | null;
}

export interface RefundRequest {
  id: UUID;
  org_id: UUID;
  student_id: UUID;
  payment_id: UUID | null;
  amount_requested: Kobo;
  amount_approved: Kobo | null;
  amount_processed: Kobo | null;
  status: RefundStatus;
  reason: string;
  requested_at: ISODateTime;
  approved_at: ISODateTime | null;
  approved_by_email: string | null;
  processed_at: ISODateTime | null;
  nomba_refund_txn_id: string | null;
  notes: string | null;
}

export interface AuditLog {
  id: UUID;
  org_id: UUID;
  entity_type: AuditEntityType;
  entity_id: UUID | null;
  action: AuditAction;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  actor_email: string | null;
  actor_role: ActorRole | null;
  request_id: string | null;
  ip_address: string | null;
  created_at: ISODateTime;
}

// ---------------------------------------------------------------------------
// Nomba webhook payload
// ---------------------------------------------------------------------------

/**
 * NOTE: confirm against the real Nomba payload. The spec displays `amount/100`
 * and stores it directly into `amount_naira` (a Kobo column), so we treat the
 * webhook `amount` as **Kobo**. If Nomba actually sends Naira, convert at the
 * boundary with `nairaToKobo()` — do NOT change the internal Kobo convention.
 */
export interface NombaTransferReceivedData {
  amount: Kobo;
  destinationAccountNumber: string;
  transactionReference: string;
  senderName?: string;
  senderAccount?: string;
  timestamp: string;
}

export interface NombaWebhookPayload {
  event: string;
  data: NombaTransferReceivedData;
}
