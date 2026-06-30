import { Controller, Get, Query, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@Controller('api/reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('collection')
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
  async getStudentReport(@Req() req: any, @Res() res: Response) {
    const csv = await this.reportsService.getStudentReport(req.user.orgId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=student-report.csv');
    return res.send(csv);
  }
}
