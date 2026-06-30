import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req,
  UploadedFile, UseInterceptors
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Students')
@ApiBearerAuth()
@Controller('api/students')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Register a new student (Admin Only)' })
  async create(@Req() req: any, @Body() dto: CreateStudentDto) {
    return await this.studentsService.create(req.user.orgId, dto, req.user);
  }

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER')
  @ApiOperation({ summary: 'List all students in the organization (Staff Only)' })
  async findAll(@Req() req: any, @Query() query: any) {
    return await this.studentsService.findAll(req.user.orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed profile of a student' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    if (req.user.role === 'STUDENT' && req.user.userId !== id) {
      throw new Error('Forbidden: You can only view your own record');
    }
    return await this.studentsService.findOne(req.user.orgId, id);
  }

  @Get(':id/fees')
  @ApiOperation({ summary: 'Get fee breakdown for a specific student' })
  async getFees(@Req() req: any, @Param('id') id: string) {
    if (req.user.role === 'STUDENT' && req.user.userId !== id) {
      throw new Error('Forbidden: You can only view your own fees');
    }
    return await this.studentsService.getFees(req.user.orgId, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update student profile (Admin Only)' })
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return await this.studentsService.update(req.user.orgId, id, dto, req.user);
  }

  @Post('bulk-import')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk import students via CSV (Admin Only)' })
  async bulkImport(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    const content = file.buffer.toString();
    const rows = content.split('\n');
    const header = rows[0].split(',');

    const students: CreateStudentDto[] = rows.slice(1)
      .filter(row => row.trim() !== '')
      .map(row => {
        const values = row.split(',');
        const obj: any = {};
        header.forEach((h, i) => obj[h.trim()] = values[i]?.trim());
        return obj as CreateStudentDto;
      });

    return await this.studentsService.bulkImport(req.user.orgId, students, req.user);
  }
}
