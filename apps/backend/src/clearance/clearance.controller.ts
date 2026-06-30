import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClearanceService } from './clearance.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Clearance & Fees')
@ApiBearerAuth()
@Controller('api')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ClearanceController {
  constructor(private readonly clearanceService: ClearanceService) {}

  @Get('clearance/:student_id')
  @ApiOperation({ summary: 'Get clearance status for a student' })
  async getClearanceStatus(@Req() req: any, @Param('student_id') studentId: string) {
    return await this.clearanceService.getClearanceStatus(req.user.orgId, studentId);
  }

  @Get('fee-types')
  @ApiOperation({ summary: 'List all active fee types' })
  async getFeeTypes(@Req() req: any) {
    return await this.clearanceService.getFeeTypes(req.user.orgId);
  }

  @Post('fee-types')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new fee type (Admin Only)' })
  async createFeeType(@Req() req: any, @Body() dto: any) {
    return await this.clearanceService.createFeeType(req.user.orgId, dto, req.user);
  }
}
