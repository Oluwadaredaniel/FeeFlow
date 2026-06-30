import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditService } from '../common/audit/audit.service';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly db: SupabaseService,
    private readonly audit: AuditService,
  ) {}

  async requestRefund(orgId: string, studentId: string, dto: any) {
    const { payment_id, amount_requested, reason } = dto;

    // 1. Verify payment exists and belongs to student
    const { data: payment } = await this.db.client
      .from('payments')
      .select('id, amount_naira')
      .eq('org_id', orgId)
      .eq('student_id', studentId)
      .eq('id', payment_id)
      .single();

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    if (amount_requested > payment.amount_naira) {
      throw new BadRequestException('Refund amount cannot exceed the original payment amount');
    }

    // 2. Create refund request
    const { data: refund, error } = await this.db.client
      .from('refund_requests')
      .insert({
        org_id: orgId,
        student_id: studentId,
        payment_id,
        amount_requested,
        reason,
        status: 'REQUESTED',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // 3. Audit
    await this.audit.record({
      orgId,
      entityType: 'PAYMENT', // Related to payment
      entityId: payment_id,
      action: 'UPDATED',
      newValue: { refund_id: refund.id, amount: amount_requested },
      actorEmail: 'student-action', // Logic should handle getting email from req
      actorRole: 'STUDENT',
    });

    return refund;
  }

  async approveRefund(orgId: string, refundId: string, dto: any, actor: any) {
    const { status, amount_approved, notes } = dto;

    // 1. Get current refund state
    const { data: oldRefund } = await this.db.client
      .from('refund_requests')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', refundId)
      .single();

    if (!oldRefund) throw new NotFoundException('Refund request not found');

    // 2. Update refund
    const { data: refund, error } = await this.db.client
      .from('refund_requests')
      .update({
        status,
        amount_approved,
        notes,
        approved_at: new Date().toISOString(),
        approved_by_email: actor.email,
      })
      .eq('id', refundId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // 3. Audit
    await this.audit.record({
      orgId,
      entityType: 'PAYMENT',
      entityId: refund.payment_id,
      action: 'UPDATED',
      oldValue: oldRefund,
      newValue: refund,
      actorEmail: actor.email,
      actorRole: actor.role,
    });

    // TODO: In production, trigger Nomba Refund API here if status === 'APPROVED'

    return refund;
  }
}
