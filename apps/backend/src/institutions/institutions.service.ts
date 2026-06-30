import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class InstitutionsService {
  constructor(private readonly db: SupabaseService) {}

  async create(dto: any) {
    const { data, error } = await this.db.client
      .from('organizations')
      .insert({
        ...dto,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.db.client
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new NotFoundException('Institution not found');
    return data;
  }
}
