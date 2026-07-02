import { Controller, Get, Query, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Reports & Analytics')
@ApiBearerAuth()
@Controller('api/reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('collection')
  @ApiOperation({ summary: 'Get revenue collection statistics (JSON or CSV)' })
  async getCollectionReport(
    @Req() req: any,
    @Query() query: any,
    @Res() res: Response
  ) {
    const report = await this.reportsService.getCollectionReport(req.user.orgId, query);

    if (query.format === 'CSV') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=collection-report.csv');
      return res.send(report);
    }

    return res.json(report);
  }

  @Get('students')
  @ApiOperation({ summary: 'Download full student population report as CSV' })
  async getStudentReport(@Req() req: any, @Res() res: Response) {
    const csv = await this.reportsService.getStudentReport(req.user.orgId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=student-report.csv');
    return res.send(csv);
  }
}
