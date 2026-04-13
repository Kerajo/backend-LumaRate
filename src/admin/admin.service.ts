import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PersonRole, Prisma, UserRole, UserStatus } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContentDto } from './dto/create-content.dto';
import { CreateCountryDto } from './dto/create-country.dto';
import { CreateGenreDto } from './dto/create-genre.dto';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

type CurrentUser = { id: string; role: UserRole };

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listContents(query: PaginationQueryDto & { type?: string; published?: string; search?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.ContentWhereInput = {
      ...(query.type ? { type: query.type as any } : {}),
      ...(query.published !== undefined ? { isPublished: query.published === 'true' } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [items, total, ratingsCount, reviewsCount] = await Promise.all([
      this.prisma.content.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: limit }),
      this.prisma.content.count({ where }),
      this.prisma.rating.groupBy({ by: ['contentId'], _count: { _all: true } }),
      this.prisma.review.groupBy({ by: ['contentId'], _count: { _all: true } }),
    ]);

    const ratingMap = new Map(ratingsCount.map((item) => [item.contentId, item._count._all]));
    const reviewMap = new Map(reviewsCount.map((item) => [item.contentId, item._count._all]));

    return {
      data: items.map((item) => ({
        id: item.id,
        type: item.type,
        slug: item.slug,
        title: item.title,
        year: item.year,
        isPublished: item.isPublished,
        ratingsCount: ratingMap.get(item.id) ?? 0,
        reviewsCount: reviewMap.get(item.id) ?? 0,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: { page, total },
    };
  }

  async createContent(user: CurrentUser, dto: CreateContentDto) {
    const existing = await this.prisma.content.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Контент со slug уже существует');

    const created = await this.prisma.content.create({
      data: {
        type: dto.type,
        title: dto.title,
        slug: dto.slug,
        year: dto.year,
        originalTitle: dto.originalTitle,
        shortDescription: dto.shortDescription,
        description: dto.description,
        posterUrl: dto.posterUrl,
        bannerUrl: dto.bannerUrl,
        ageRating: dto.ageRating,
        durationMinutes: dto.durationMinutes,
        seasonsCount: dto.seasonsCount,
        episodesCount: dto.episodesCount,
        externalRatingImdb: dto.externalRatingImdb,
        externalRatingKinopoisk: dto.externalRatingKinopoisk,
        isPublished: dto.isPublished ?? false,
        isFeatured: dto.isFeatured ?? false,
        createdById: user.id,
        genres: dto.genreIds?.length
          ? { createMany: { data: dto.genreIds.map((genreId) => ({ genreId })) } }
          : undefined,
        countries: dto.countryIds?.length
          ? { createMany: { data: dto.countryIds.map((countryId) => ({ countryId })) } }
          : undefined,
        persons: {
          create: [
            ...(dto.directorIds ?? []).map((personId, index) => ({ personId, roleType: PersonRole.DIRECTOR, sortOrder: index })),
            ...(dto.actorIds ?? []).map((personId, index) => ({ personId, roleType: PersonRole.ACTOR, sortOrder: index })),
          ],
        },
        trailers: dto.trailers?.length
          ? {
              create: dto.trailers.map((trailer, index) => ({
                title: trailer.title,
                provider: trailer.provider,
                videoUrl: trailer.videoUrl,
                previewImageUrl: trailer.previewImageUrl,
                sortOrder: index,
              })),
            }
          : undefined,
      },
    });

    return { message: 'Контент создан', id: created.id, slug: created.slug };
  }

  async updateContent(id: string, dto: UpdateContentDto) {
    const existing = await this.prisma.content.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Контент не найден');

    await this.prisma.$transaction(async (tx) => {
      await tx.content.update({
        where: { id },
        data: {
          type: dto.type,
          title: dto.title,
          slug: dto.slug,
          year: dto.year,
          originalTitle: dto.originalTitle,
          shortDescription: dto.shortDescription,
          description: dto.description,
          posterUrl: dto.posterUrl,
          bannerUrl: dto.bannerUrl,
          ageRating: dto.ageRating,
          durationMinutes: dto.durationMinutes,
          seasonsCount: dto.seasonsCount,
          episodesCount: dto.episodesCount,
          externalRatingImdb: dto.externalRatingImdb,
          externalRatingKinopoisk: dto.externalRatingKinopoisk,
          isPublished: dto.isPublished,
          isFeatured: dto.isFeatured,
        },
      });

      if (dto.genreIds) {
        await tx.contentGenre.deleteMany({ where: { contentId: id } });
        if (dto.genreIds.length) {
          await tx.contentGenre.createMany({ data: dto.genreIds.map((genreId) => ({ contentId: id, genreId })) });
        }
      }
      if (dto.countryIds) {
        await tx.contentCountry.deleteMany({ where: { contentId: id } });
        if (dto.countryIds.length) {
          await tx.contentCountry.createMany({ data: dto.countryIds.map((countryId) => ({ contentId: id, countryId })) });
        }
      }
      if (dto.directorIds || dto.actorIds) {
        await tx.contentPerson.deleteMany({ where: { contentId: id } });
        const persons = [
          ...(dto.directorIds ?? []).map((personId, index) => ({ contentId: id, personId, roleType: PersonRole.DIRECTOR, sortOrder: index })),
          ...(dto.actorIds ?? []).map((personId, index) => ({ contentId: id, personId, roleType: PersonRole.ACTOR, sortOrder: index })),
        ];
        if (persons.length) {
          await tx.contentPerson.createMany({ data: persons });
        }
      }
      if (dto.trailers) {
        await tx.trailer.deleteMany({ where: { contentId: id } });
        if (dto.trailers.length) {
          await tx.trailer.createMany({
            data: dto.trailers.map((trailer, index) => ({
              contentId: id,
              title: trailer.title,
              provider: trailer.provider,
              videoUrl: trailer.videoUrl,
              previewImageUrl: trailer.previewImageUrl,
              sortOrder: index,
            })),
          });
        }
      }
    });

    return { message: 'Контент обновлён', id };
  }

  async deleteContent(id: string) {
    const existing = await this.prisma.content.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Контент не найден');
    await this.prisma.content.delete({ where: { id } });
    return { message: 'Контент удалён' };
  }

  async listUsers(query: PaginationQueryDto & { role?: UserRole; status?: UserStatus; search?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { login: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.user.count({ where }),
    ]);

    const userIds = users.map((user) => user.id);
    const [ratingsCount, reviewsCount] = await Promise.all([
      this.prisma.rating.groupBy({ by: ['userId'], where: { userId: { in: userIds } }, _count: { _all: true } }),
      this.prisma.review.groupBy({ by: ['userId'], where: { userId: { in: userIds } }, _count: { _all: true } }),
    ]);
    const ratingMap = new Map(ratingsCount.map((item) => [item.userId, item._count._all]));
    const reviewMap = new Map(reviewsCount.map((item) => [item.userId, item._count._all]));

    return {
      data: users.map((user) => ({
        id: user.id,
        login: user.login,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        deletedAt: user.deletedAt,
        stats: {
          ratingsCount: ratingMap.get(user.id) ?? 0,
          reviewsCount: reviewMap.get(user.id) ?? 0,
        },
      })),
      pagination: { page, total },
    };
  }

  async updateUserRole(userId: string, dto: UpdateUserRoleDto) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException('Пользователь не найден');

    if (existing.role === UserRole.ADMIN && dto.role !== UserRole.ADMIN) {
      const adminsCount = await this.prisma.user.count({ where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE } });
      if (adminsCount <= 1) {
        throw new BadRequestException('Попытка снять роль ADMIN с последнего администратора');
      }
    }

    await this.prisma.user.update({ where: { id: userId }, data: { role: dto.role } });
    return { message: 'Роль пользователя обновлена', userId, newRole: dto.role };
  }

  async deactivateUser(userId: string) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException('Пользователь не найден');
    if (existing.role === UserRole.ADMIN) {
      const adminsCount = await this.prisma.user.count({ where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE } });
      if (adminsCount <= 1) {
        throw new BadRequestException('Нельзя деактивировать последнего администратора');
      }
    }
    await this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.DELETED, deletedAt: new Date() } });
    return { message: 'Пользователь деактивирован', userId };
  }

  listGenres() {
    return this.prisma.genre.findMany({ orderBy: { name: 'asc' } });
  }

  createGenre(dto: CreateGenreDto) {
    return this.prisma.genre.create({ data: dto });
  }

  updateGenre(id: string, dto: Partial<CreateGenreDto>) {
    return this.prisma.genre.update({ where: { id }, data: dto });
  }

  async deleteGenre(id: string) {
    await this.prisma.genre.delete({ where: { id } });
    return { message: 'Жанр удалён' };
  }

  listCountries() {
    return this.prisma.country.findMany({ orderBy: { name: 'asc' } });
  }

  createCountry(dto: CreateCountryDto) {
    return this.prisma.country.create({ data: { ...dto, code: dto.code.toUpperCase() } });
  }

  updateCountry(id: string, dto: Partial<CreateCountryDto>) {
    return this.prisma.country.update({
      where: { id },
      data: { ...dto, ...(dto.code ? { code: dto.code.toUpperCase() } : {}) },
    });
  }

  async deleteCountry(id: string) {
    await this.prisma.country.delete({ where: { id } });
    return { message: 'Страна удалена' };
  }

  listPersons() {
    return this.prisma.person.findMany({ orderBy: { fullName: 'asc' } });
  }

  createPerson(dto: CreatePersonDto) {
    return this.prisma.person.create({ data: dto });
  }

  updatePerson(id: string, dto: Partial<CreatePersonDto>) {
    return this.prisma.person.update({ where: { id }, data: dto });
  }

  async deletePerson(id: string) {
    await this.prisma.person.delete({ where: { id } });
    return { message: 'Персона удалена' };
  }
}
