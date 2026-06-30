import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ReportsService {
  constructor(private readonly db: SupabaseService) {}

  async getCollectionReport(orgId: string, query: any) {
    const { fiscal_year, department, format = 'JSON' } = query;

    // This would typically involve several aggregate queries or a dedicated reporting table/view.
    // For MVP, we'll calculate it from core tables.

    // 1. Basic stats
    const { data: org } = await this.db.client.from('organizations').select('name').eq('id', orgId).single();

    const { data: students } = await this.db.client
      .from('students')
      .select('id, department, clearance_status(is_cleared)')
      .eq('org_id', orgId);

    const { data: payments } = await this.db.client
      .from('payments')
      .select('amount_naira, created_at')
      .eq('org_id', orgId);

    const { data: fees } = await this.db.client
      .from('student_fees')
      .select('amount_due, amount_paid, fee_types(name)')
      .eq('org_id', orgId);

    const total_revenue = payments?.reduce((acc, p) => acc + p.amount_naira, 0) || 0;
    const total_students = students?.length || 0;
    const students_cleared = students?.filter(s => s.clearance_status?.[0]?.is_cleared).length || 0;

    // Summary by fee type
    const feeTypeMap = new Map();
    fees?.forEach(f => {
      const name = f.fee_types.name;
      if (!feeTypeMap.has(name)) {
        feeTypeMap.set(name, { expected: 0, collected: 0 });
      }
      const stats = feeTypeMap.get(name);
      stats.expected += f.amount_due;
      stats.collected += f.amount_paid;
    });

    const by_fee_type = Array.from(feeTypeMap.entries()).map(([name, stats]) => ({
      fee_type: name,
      amount_expected: stats.expected,
      amount_collected: stats.collected,
      collection_rate: stats.expected > 0 ? (stats.collected / stats.expected) * 100 : 0,
    }));

    const report = {
      report_date: new Date().toISOString(),
      period: fiscal_year || 'Current',
      institution: org?.name,
      summary: {
        total_revenue,
        total_students,
        students_cleared,
        students_owing: total_students - students_cleared,
        collection_rate: (students_cleared / total_students) * 100,
      },
      by_fee_type,
      // ... more breakdowns (department, monthly) could be added here
    };

    if (format === 'CSV') {
      // Simple CSV conversion
      let csv = 'fee_type,amount_expected,amount_collected,collection_rate\n';
      by_fee_type.forEach(f => {
        csv += `${f.fee_type},${f.amount_expected},${f.amount_collected},${f.collection_rate}\n`;
      });
      return csv;
    }

    return report;
  }

  async getStudentReport(orgId: string) {
    const { data, error } = await this.db.client
      .from('students')
      .select(`
        matric_number,
        first_name,
        last_name,
        email,
        department,
        status,
        student_fees (amount_balance),
        clearance_status (is_cleared)
      `)
      .eq('org_id', orgId);

    if (error) throw new BadRequestException(error.message);

    let csv = 'matric_number,first_name,last_name,email,department,status,total_owed,is_cleared\n';
    data.forEach((s: any) => {
      const total_owed = s.student_fees.reduce((acc: number, f: any) => acc + f.amount_balance, 0);
      const is_cleared = s.clearance_status?.[0]?.is_cleared || false;
      csv += `${s.matric_number},${s.first_name},${s.last_name},${s.email},${s.department},${s.status},${total_owed},${is_cleared}\n`;
    });

    return csv;
  }
}
