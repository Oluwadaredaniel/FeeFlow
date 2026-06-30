import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaymentsService } from './payments.service';

@Controller('api')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('payments/:student_id')
  async getHistory(
    @Req() req: any,
    @Param('student_id') studentId: string,
    @Query() query: any
  ) {
    // Student can only view their own history
    if (req.user.role === 'STUDENT' && req.user.userId !== studentId) {
      throw new Error('Forbidden: You can only view your own payment history');
    }
    return await this.paymentsService.getHistory(req.user.orgId, studentId, query);
  }

  @Get('debtors')
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER')
  async getDebtors(@Req() req: any, @Query() query: any) {
    return await this.paymentsService.getDebtors(req.user.orgId, query);
  }
}
