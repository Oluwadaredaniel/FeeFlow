import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly db: SupabaseService) {}

  async getHistory(orgId: string, studentId: string, query: any) {
    const { limit = 20, offset = 0, sort = 'created_at', order = 'DESC' } = query;

    const { data, count, error } = await this.db.client
      .from('payments')
      .select(`
        *,
        payment_allocations (
          allocated_amount,
          student_fees (
            fee_types (name)
          )
        )
      `, { count: 'exact' })
      .eq('org_id', orgId)
      .eq('student_id', studentId)
      .range(offset, offset + limit - 1)
      .order(sort, { ascending: order === 'ASC' });

    if (error) throw new BadRequestException(error.message);

    return {
      data: data.map((p: any) => ({
        id: p.id,
        amount_naira: p.amount_naira,
        nomba_transaction_id: p.nomba_transaction_id,
        sender_name: p.sender_name,
        status: p.status,
        reconciliation_status: p.reconciliation_status,
        created_at: p.created_at,
        receipt_url: `https://feeflow.io/receipts/${p.id}.pdf`, // Mock URL
        allocations: p.payment_allocations.map((pa: any) => ({
          fee_type: pa.student_fees.fee_types.name,
          amount: pa.allocated_amount,
        })),
      })),
      pagination: {
        total: count,
        limit,
        offset,
      },
    };
  }

  async getDebtors(orgId: string, query: any) {
    const { department, sort = 'total_owed', order = 'DESC', limit = 50, offset = 0 } = query;

    // This is a complex query. In Supabase, we might want a view or a function.
    // For now, let's try to do it with a join or a RPC.
    // The spec says: student_id, matric_number, first_name, last_name, total_owed, oldest_fee_days_overdue, fees[...]

    let dbQuery = this.db.client
      .from('students')
      .select(`
        id,
        matric_number,
        first_name,
        last_name,
        department,
        student_fees!inner (
          amount_due,
          amount_paid,
          amount_balance,
          status,
          due_date,
          fee_types (name)
        )
      `)
      .eq('org_id', orgId)
      .gt('student_fees.amount_balance', 0); // Only debtors

    if (department) dbQuery = dbQuery.eq('department', department);

    const { data, error } = await dbQuery;

    if (error) throw new BadRequestException(error.message);

    // Post-process the data to calculate total_owed and filter
    const debtors = data.map((s: any) => {
      const total_owed = s.student_fees.reduce((acc: number, f: any) => acc + f.amount_balance, 0);
      const oldest_fee = s.student_fees.reduce((oldest: any, f: any) => {
        if (!f.due_date) return oldest;
        if (!oldest || new Date(f.due_date) < new Date(oldest)) return f.due_date;
        return oldest;
      }, null);

      const days_overdue = oldest_fee ? Math.floor((Date.now() - new Date(oldest_fee).getTime()) / (1000 * 60 * 60 * 24)) : 0;

      return {
        student_id: s.id,
        matric_number: s.matric_number,
        first_name: s.first_name,
        last_name: s.last_name,
        total_owed,
        oldest_fee_days_overdue: Math.max(0, days_overdue),
        fees: s.student_fees.map((f: any) => ({
          fee_type: f.fee_types.name,
          amount_owed: f.amount_balance,
          status: f.status,
        })),
      };
    });

    // Sorting
    debtors.sort((a, b) => {
      const valA = a[sort as keyof typeof a] || 0;
      const valB = b[sort as keyof typeof b] || 0;
      return order === 'DESC' ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
    });

    // Pagination
    const paginatedData = debtors.slice(offset, offset + limit);

    return {
      data: paginatedData,
      pagination: {
        total: debtors.length,
        limit,
        offset,
      },
      summary: {
        total_outstanding: debtors.reduce((acc, d) => acc + d.total_owed, 0),
        students_owing: debtors.length,
        average_debt_per_student: debtors.length > 0 ? debtors.reduce((acc, d) => acc + d.total_owed, 0) / debtors.length : 0,
      },
    };
  }
}
