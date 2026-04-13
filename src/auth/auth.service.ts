import { ConflictException, Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthSession, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const login = dto.login.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { login } });

    if (existingUser) {
      throw new ConflictException('Пользователь с таким login уже существует');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: { login, passwordHash },
      select: { id: true, login: true, role: true, createdAt: true },
    });

    return user;
  }

  async login(dto: LoginDto) {
    const login = dto.login.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { login } });

    if (!user) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    if (user.status === UserStatus.DELETED) {
      throw new UnauthorizedException('Аккаунт деактивирован');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isValidPassword) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const payload: JwtPayload = {
      sub: user.id,
      login: user.login,
      role: user.role,
      status: user.status,
    };

    const accessToken = await this.signAccessToken(payload);
    const refreshToken = await this.signRefreshToken(payload);

    await this.createSession(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        login: user.login,
        role: user.role,
      },
    };
  }

  async refresh(dto: RefreshDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);

    const session = await this.findValidSession(payload.sub, dto.refreshToken);
    if (!session) {
      throw new UnauthorizedException('refresh_token невалиден, истёк или был отозван');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === UserStatus.DELETED) {
      throw new UnauthorizedException('Пользователь недоступен');
    }

    const cleanPayload: JwtPayload = {
      sub: user.id,
      login: user.login,
      role: user.role,
      status: user.status,
    };

    return {
      accessToken: await this.signAccessToken(cleanPayload),
    };
  }

  async logout(currentUserId: string, dto: LogoutDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);

    if (payload.sub !== currentUserId) {
      throw new UnauthorizedException('Refresh token не принадлежит текущему пользователю');
    }

    const sessions = await this.prisma.authSession.findMany({
      where: {
        userId: currentUserId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    let revoked = false;

    for (const session of sessions) {
      const matches = await bcrypt.compare(dto.refreshToken, session.refreshTokenHash);
      if (matches) {
        await this.prisma.authSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        revoked = true;
        break;
      }
    }

    if (!revoked) {
      throw new UnauthorizedException('Refresh token не найден');
    }

    return { message: 'Выход выполнен успешно' };
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(userId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    const expiresAt = this.decodeJwtExpiry(refreshToken);

    await this.prisma.authSession.create({
      data: { userId, refreshTokenHash, expiresAt },
    });
  }

  private async verifyRefreshToken(refreshToken: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<any>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'super-secret-refresh-key',
      });

      return {
        sub: payload.sub,
        login: payload.login,
        role: payload.role,
        status: payload.status,
      };
    } catch {
      throw new UnauthorizedException('refresh_token невалиден, истёк или был отозван');
    }
  }

  private async findValidSession(userId: string, refreshToken: string): Promise<AuthSession | null> {
    const sessions = await this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const session of sessions) {
      const matches = await bcrypt.compare(refreshToken, session.refreshTokenHash);
      if (matches) {
        return session;
      }
    }

    return null;
  }

  private async signAccessToken(payload: JwtPayload) {
    return this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? 'super-secret-access-key',
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    });
  }

  private async signRefreshToken(payload: JwtPayload) {
    return this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? 'super-secret-refresh-key',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    });
  }

  private decodeJwtExpiry(token: string): Date {
    const decoded = this.jwtService.decode(token) as { exp?: number } | null;

    if (!decoded?.exp) {
      throw new UnprocessableEntityException('Не удалось определить срок жизни refresh token');
    }

    return new Date(decoded.exp * 1000);
  }
}
