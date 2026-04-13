import { UserRole, UserStatus } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  login: string;
  role: UserRole;
  status: UserStatus;
}
