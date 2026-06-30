import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { AuditService } from '../common/audit/audit.service';
import { NombaService } from '../common/nomba/nomba.service';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly db: SupabaseService,
    private readonly audit: AuditService,
    private readonly nomba: NombaService,
  ) {}

  async create(orgId: string, dto: CreateStudentDto, actor: any) {
    // 1. Check if student already exists
    const { data: existing } = await this.db.client
      .from('students')
      .select('id')
      .eq('org_id', orgId)
      .or(`email.eq.${dto.email},matric_number.eq.${dto.matric_number}`)
      .maybeSingle();

    if (existing) {
      throw new ConflictException('Student with this email or matric number already exists');
    }

    // 2. Create student record
    const { data: student, error: studentErr } = await this.db.client
      .from('students')
      .insert({
        org_id: orgId,
        ...dto,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (studentErr) {
      this.logger.error(`Failed to create student: ${studentErr.message}`);
      throw new BadRequestException('Failed to create student');
    }

    // 3. Create virtual account via Nomba
    let vaInfo;
    try {
      vaInfo = await this.nomba.createVirtualAccount({
        email: student.email,
        firstName: student.first_name || '',
        lastName: student.last_name || '',
        accountName: `${student.last_name}, ${student.first_name}`,
      });
    } catch (err) {
      this.logger.error(`VA creation failed for student ${student.id}: ${err.message}`);
      // In production, you might queue this for retry or mark student as "pending_va"
    }

    if (vaInfo) {
      const { data: va, error: vaErr } = await this.db.client
        .from('virtual_accounts')
        .insert({
          org_id: orgId,
          student_id: student.id,
          account_number: vaInfo.accountNumber,
          account_name: `${student.last_name}, ${student.first_name}`,
          bank_name: vaInfo.bankName || 'Nomba',
          status: 'ACTIVE',
          is_primary: true,
        })
        .select()
        .single();

      if (vaErr) {
        this.logger.error(`Failed to persist virtual account: ${vaErr.message}`);
      }
      student.virtual_account = va;
    }

    // 4. Audit the creation
    await this.audit.record({
      orgId,
      entityType: 'STUDENT',
      entityId: student.id,
      action: 'CREATED',
      newValue: student,
      actorEmail: actor.email,
      actorRole: actor.role,
    });

    return student;
  }

  async findAll(orgId: string, query: any) {
    const { status, department, limit = 20, offset = 0 } = query;

    let dbQuery = this.db.client
      .from('students')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId);

    if (status) dbQuery = dbQuery.eq('status', status);
    if (department) dbQuery = dbQuery.eq('department', department);

    const { data, count, error } = await dbQuery
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return {
      data,
      pagination: {
        total: count,
        limit,
        offset,
      },
    };
  }

  async findOne(orgId: string, id: string) {
    const { data: student, error } = await this.db.client
      .from('students')
      .select(`
        *,
        virtual_accounts (*),
        student_fees (
          *,
          fee_types (name)
        ),
        clearance_status (*)
      `)
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!student) throw new NotFoundException('Student not found');

    return {
      ...student,
      virtual_account: student.virtual_accounts?.find((va: any) => va.status === 'ACTIVE'),
      fees: student.student_fees?.map((sf: any) => ({
        id: sf.id,
        fee_type: sf.fee_types.name,
        amount_due: sf.amount_due,
        amount_paid: sf.amount_paid,
        amount_balance: sf.amount_balance,
        status: sf.status,
      })) || [],
      clearance_status: student.clearance_status?.[0] || null,
    };
  }

  async getFees(orgId: string, id: string) {
    const { data: student, error } = await this.db.client
      .from('students')
      .select(`
        id,
        student_fees (
          id,
          amount_due,
          amount_paid,
          amount_balance,
          status,
          due_date,
          fee_types (name, is_clearance_required)
        )
      `)
      .eq('org_id', orgId)
      .eq('id', id)
      .single();

    if (error) throw new BadRequestException(error.message);
    if (!student) throw new NotFoundException('Student not found');

    const fees = student.student_fees.map((sf: any) => ({
      id: sf.id,
      fee_type: sf.fee_types.name,
      amount_due: sf.amount_due,
      amount_paid: sf.amount_paid,
      amount_balance: sf.amount_balance,
      status: sf.status,
      is_clearance_required: sf.fee_types.is_clearance_required,
      due_date: sf.due_date,
    }));

    return {
      student_id: student.id,
      fees,
      total_owed: fees.reduce((acc: number, f: any) => acc + f.amount_balance, 0),
      total_paid: fees.reduce((acc: number, f: any) => acc + f.amount_paid, 0),
    };
  }

  async update(orgId: string, id: string, dto: any, actor: any) {
    // Get old value for audit
    const { data: oldStudent } = await this.db.client
      .from('students')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', id)
      .single();

    const { data, error } = await this.db.client
      .from('students')
      .update(dto)
      .eq('org_id', orgId)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Audit the update
    await this.audit.record({
      orgId,
      entityType: 'STUDENT',
      entityId: id,
      action: 'UPDATED',
      oldValue: oldStudent,
      newValue: data,
      actorEmail: actor.email,
      actorRole: actor.role,
    });

    return data;
  }

  async bulkImport(orgId: string, students: CreateStudentDto[], actor: any) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    // For production, this should be enqueued as a BullMQ job if the file is large
    for (const studentDto of students) {
      try {
        await this.create(orgId, studentDto, actor);
        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({ email: studentDto.email, error: err.message });
      }
    }

    return {
      success: true,
      imported: results.success,
      failed: results.failed,
      message: `${results.success} students imported successfully`,
      errors: results.errors,
    };
  }
}
