import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Payments & Debtors')
@ApiBearerAuth()
@Controller('api')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('payments/:student_id')
  @ApiOperation({ summary: 'Get payment history for a specific student' })
  async getHistory(
    @Req() req: any,
    @Param('student_id') studentId: string,
    @Query() query: any
  ) {
    if (req.user.role === 'STUDENT' && req.user.userId !== studentId) {
      throw new Error('Forbidden: You can only view your own payment history');
    }
    return await this.paymentsService.getHistory(req.user.orgId, studentId, query);
  }

  @Get('debtors')
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER')
  @ApiOperation({ summary: 'List all students with outstanding balances (Staff Only)' })
  async getDebtors(@Req() req: any, @Query() query: any) {
    return await this.paymentsService.getDebtors(req.user.orgId, query);
  }
}
