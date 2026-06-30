import { Controller, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RefundsService } from './refunds.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Refunds')
@ApiBearerAuth()
@Controller('api/refunds')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @ApiOperation({ summary: 'Request a refund (Student)' })
  async requestRefund(@Req() req: any, @Body() dto: any) {
    return await this.refundsService.requestRefund(req.user.orgId, req.user.userId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER')
  @ApiOperation({ summary: 'Approve or reject a refund (Admin Only)' })
  async approveRefund(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any
  ) {
    return await this.refundsService.approveRefund(req.user.orgId, id, dto, req.user);
  }
}
