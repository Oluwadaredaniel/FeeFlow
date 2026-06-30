import { SetMetadata } from '@nestjs/common';
import { ActorRole } from '@feeflow/core';

export const Roles = (...roles: ActorRole[]) => SetMetadata('roles', roles);
