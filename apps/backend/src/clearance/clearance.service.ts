import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ClearanceService {
  constructor(private readonly db: SupabaseService) {}

  async getClearanceStatus(orgId: string, studentId: string) {
    const { data: student, error: studentErr } = await this.db.client
      .from('students')
      .select(`
        id,
        clearance_status (*),
        student_fees (
          id,
          amount_due,
          amount_paid,
          status,
          fee_types (name, is_clearance_required)
        )
      `)
      .eq('org_id', orgId)
      .eq('id', studentId)
      .single();

    if (studentErr) throw new NotFoundException('Student not found');

    const fees = student.student_fees.map((sf: any) => ({
      fee_type: sf.fee_types.name,
      status: sf.status,
      amount_due: sf.amount_due,
      amount_paid: sf.amount_paid,
      is_clearance_required: sf.fee_types.is_clearance_required,
    }));

    return {
      student_id: student.id,
      is_cleared: student.clearance_status?.[0]?.is_cleared || false,
      cleared_at: student.clearance_status?.[0]?.cleared_at || null,
      clearance_certificate_url: `https://feeflow.io/certificates/${student.id}.pdf`,
      required_fees: fees.filter((f: any) => f.is_clearance_required),
      optional_fees: fees.filter((f: any) => !f.is_clearance_required),
    };
  }

  async getFeeTypes(orgId: string) {
    const { data, error } = await this.db.client
      .from('fee_types')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'ACTIVE');

    if (error) throw new BadRequestException(error.message);
    return { data };
  }

  async createFeeType(orgId: string, dto: any) {
    const { data, error } = await this.db.client
      .from('fee_types')
      .insert({
        org_id: orgId,
        ...dto,
        version: 1,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
