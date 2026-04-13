import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeactivateAccountDto } from './dto/deactivate-account.dto';

type CurrentUser = { id: string; role: UserRole };

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async getMe(user: CurrentUser) {
    const [profile, ratingsCount, reviewsCount, favoritesCount, recensionsCount] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.id }, select: { id: true, login: true, role: true, createdAt: true } }),
      this.prisma.rating.count({ where: { userId: user.id } }),
      this.prisma.review.count({ where: { userId: user.id } }),
      this.prisma.favorite.count({ where: { userId: user.id } }),
      user.role === UserRole.EXPERT || user.role === UserRole.ADMIN
        ? this.prisma.recension.count({ where: { expertUserId: user.id } })
        : Promise.resolve(null),
    ]);

    if (!profile) {
      throw new NotFoundException('Пользователь не найден');
    }

    return {
      ...profile,
      stats: {
        ratingsCount,
        reviewsCount,
        favoritesCount,
        recensionsCount,
      },
    };
  }

  async getMyReviews(user: CurrentUser, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId: user.id },
        include: {
          content: { select: { id: true, slug: true, title: true, posterUrl: true } },
          rating: { select: { score: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { userId: user.id } }),
    ]);

    return {
      data: items.map((review) => ({
        id: review.id,
        content: review.content,
        rating: review.rating.score,
        text: review.text,
        status: review.status,
        createdAt: review.createdAt,
        canDelete: true,
      })),
      pagination: { page, total },
    };
  }

  async getMyRatings(user: CurrentUser, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.rating.findMany({
        where: { userId: user.id },
        include: { content: { select: { id: true, slug: true, title: true, posterUrl: true, type: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.rating.count({ where: { userId: user.id } }),
    ]);

    return {
      data: items.map((rating) => ({
        id: rating.id,
        content: rating.content,
        score: rating.score,
        createdAt: rating.createdAt,
      })),
      pagination: { page, total },
    };
  }

  async getFavorites(user: CurrentUser, query: PaginationQueryDto & { sort?: 'newest' | 'oldest' | 'title_asc' }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const orderBy =
      query.sort === 'title_asc'
        ? [{ content: { title: 'asc' as const } }]
        : [{ createdAt: query.sort === 'oldest' ? ('asc' as const) : ('desc' as const) }];

    const [items, total, ratings] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId: user.id },
        include: { content: { include: { genres: { include: { genre: true } } } } },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.favorite.count({ where: { userId: user.id } }),
      this.prisma.rating.groupBy({
        by: ['contentId'],
        where: { contentId: { in: (await this.prisma.favorite.findMany({ where: { userId: user.id }, select: { contentId: true } })).map((x) => x.contentId) } },
        _avg: { score: true },
      }),
    ]);

    const ratingMap = new Map(ratings.map((item) => [item.contentId, item._avg.score]));

    return {
      data: items.map(({ content }) => ({
        id: content.id,
        slug: content.slug,
        type: content.type,
        title: content.title,
        originalTitle: content.originalTitle,
        posterUrl: content.posterUrl,
        year: content.year,
        ageRating: content.ageRating,
        genres: content.genres.map((genre) => ({ name: genre.genre.name, slug: genre.genre.slug })),
        siteRating: ratingMap.get(content.id) ? Number(Number(ratingMap.get(content.id)).toFixed(1)) : null,
        imdbRating: content.externalRatingImdb ? Number(content.externalRatingImdb) : null,
        kinopoiskRating: content.externalRatingKinopoisk ? Number(content.externalRatingKinopoisk) : null,
        seriesInfo:
          content.type === 'SERIES'
            ? [content.seasonsCount ? `${content.seasonsCount} сезона` : null, content.episodesCount ? `${content.episodesCount} серий` : null]
                .filter(Boolean)
                .join(', ')
            : null,
        isFavorite: true,
        myRating: null,
      })),
      pagination: { page, total },
    };
  }

  async addFavorite(user: CurrentUser, contentId: string) {
    const content = await this.prisma.content.findFirst({ where: { id: contentId, isPublished: true } });
    if (!content) {
      throw new NotFoundException('Контент не найден');
    }

    const existing = await this.prisma.favorite.findUnique({ where: { userId_contentId: { userId: user.id, contentId } } });
    if (existing) {
      throw new ConflictException('Контент уже добавлен в избранное');
    }

    await this.prisma.favorite.create({ data: { userId: user.id, contentId } });
    return { message: 'Добавлено в избранное', contentId };
  }

  async removeFavorite(user: CurrentUser, contentId: string) {
    const existing = await this.prisma.favorite.findUnique({ where: { userId_contentId: { userId: user.id, contentId } } });
    if (!existing) {
      throw new NotFoundException('Элемент избранного не найден');
    }

    await this.prisma.favorite.delete({ where: { id: existing.id } });
    return { message: 'Удалено из избранного' };
  }

  async changePassword(user: CurrentUser, dto: ChangePasswordDto) {
    const current = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!current) {
      throw new NotFoundException('Пользователь не найден');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, current.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Текущий пароль неверный');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.authService.revokeAllSessions(user.id);
    return { message: 'Пароль успешно изменён' };
  }

  async deactivateAccount(user: CurrentUser, dto: DeactivateAccountDto) {
    const current = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!current) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (dto.password) {
      const isValid = await bcrypt.compare(dto.password, current.passwordHash);
      if (!isValid) {
        throw new UnauthorizedException('Текущий пароль неверный');
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.DELETED, deletedAt: new Date() },
    });
    await this.authService.revokeAllSessions(user.id);
    return { message: 'Аккаунт деактивирован' };
  }
}
