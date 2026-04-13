import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  ADMIN: ['ADMIN', 'MODERATOR', 'EXPERT', 'USER'],
  MODERATOR: ['MODERATOR', 'USER'],
  EXPERT: ['EXPERT', 'USER'],
  USER: ['USER'],
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: UserRole } | undefined;
    if (!user?.role) {
      throw new ForbiddenException('Недостаточно прав');
    }

    const actualRoles = ROLE_HIERARCHY[user.role] ?? [];
    if (!requiredRoles.some((role) => actualRoles.includes(role))) {
      throw new ForbiddenException('Недостаточно прав');
    }

    return true;
  }
}
