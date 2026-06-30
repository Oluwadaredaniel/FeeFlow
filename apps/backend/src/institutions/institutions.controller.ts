import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InstitutionsService } from './institutions.service';

@Controller('api/institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post()
  // @UseGuards(AuthGuard('jwt')) // Super Admin only - should add a role guard
  async create(@Body() dto: any) {
    return await this.institutionsService.create(dto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async findOne(@Param('id') id: string) {
    return await this.institutionsService.findOne(id);
  }
}
