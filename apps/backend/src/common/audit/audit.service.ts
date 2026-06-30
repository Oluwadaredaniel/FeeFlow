import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditAction, AuditEntityType, ActorRole } from '@feeflow/core';

@Injectable()
export class AuditService {
  constructor(private readonly db: SupabaseService) {}

  async record(params: {
    orgId: string;
    entityType: AuditEntityType;
    entityId?: string;
    action: AuditAction;
    oldValue?: any;
    newValue?: any;
    actorEmail: string;
    actorRole: ActorRole;
    ip?: string;
    requestId?: string;
  }) {
    // We use the service-role client to ensure audit logs are always written
    // regardless of RLS on the audit_logs table itself.
    await this.db.client.from('audit_logs').insert({
      org_id: params.orgId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      old_value: params.oldValue,
      new_value: params.newValue,
      actor_email: params.actorEmail,
      actor_role: params.actorRole,
      ip_address: params.ip,
      request_id: params.requestId,
    });
  }
}
