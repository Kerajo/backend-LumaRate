import { Injectable, NotFoundException } from '@nestjs/common';
import { Content, ContentType, Prisma, ReviewStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';

type MaybeUser = { id: string; role: UserRole } | null;

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async getHome(user: MaybeUser) {
    const [heroBanner, newReleases, topCandidates, inCinema, movies, series, cartoons, genres] = await Promise.all([
      this.prisma.content.findFirst({ where: { isPublished: true, isFeatured: true }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.content.findMany({ where: { isPublished: true }, orderBy: { createdAt: 'desc' }, take: 10, include: this.cardInclude() }),
      this.prisma.content.findMany({ where: { isPublished: true }, orderBy: { updatedAt: 'desc' }, take: 25, include: this.cardInclude() }),
      this.prisma.content.findMany({ where: { isPublished: true, year: { gte: new Date().getUTCFullYear() - 1 } }, orderBy: { year: 'desc' }, take: 10, include: this.cardInclude() }),
      this.prisma.content.findMany({ where: { isPublished: true, type: ContentType.MOVIE }, orderBy: { createdAt: 'desc' }, take: 10, include: this.cardInclude() }),
      this.prisma.content.findMany({ where: { isPublished: true, type: ContentType.SERIES }, orderBy: { createdAt: 'desc' }, take: 10, include: this.cardInclude() }),
      this.prisma.content.findMany({ where: { isPublished: true, type: ContentType.CARTOON }, orderBy: { createdAt: 'desc' }, take: 10, include: this.cardInclude() }),
      this.prisma.genre.findMany({ orderBy: { name: 'asc' } }),
    ]);

    const top10 = (await this.enrichCards(topCandidates, user?.id ?? null))
      .sort((a, b) => (b.siteRating ?? 0) - (a.siteRating ?? 0))
      .slice(0, 10);

    return {
      heroBanner: heroBanner
        ? {
            id: heroBanner.id,
            slug: heroBanner.slug,
            title: heroBanner.title,
            bannerUrl: heroBanner.bannerUrl,
            shortDescription: heroBanner.shortDescription,
          }
        : null,
      newReleases: await this.enrichCards(newReleases, user?.id ?? null),
      top10,
      inCinema: await this.enrichCards(inCinema, user?.id ?? null),
      movies: await this.enrichCards(movies, user?.id ?? null),
      series: await this.enrichCards(series, user?.id ?? null),
      cartoons: await this.enrichCards(cartoons, user?.id ?? null),
      genres,
    };
  }

  async getCatalog(query: CatalogQueryDto, user: MaybeUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ContentWhereInput = {
      isPublished: true,
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { originalTitle: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.year_from || query.year_to
        ? {
            year: {
              ...(query.year_from ? { gte: query.year_from } : {}),
              ...(query.year_to ? { lte: query.year_to } : {}),
            },
          }
        : {}),
      ...(query.genre_ids?.length
        ? { genres: { some: { genreId: { in: query.genre_ids } } } }
        : {}),
      ...(query.country_ids?.length
        ? { countries: { some: { countryId: { in: query.country_ids } } } }
        : {}),
    };

    const orderBy = this.resolveCatalogOrder(query.sort);
    const [items, total, genres, countries, yearRangeRaw] = await Promise.all([
      this.prisma.content.findMany({ where, include: this.cardInclude(), orderBy, skip, take: limit }),
      this.prisma.content.count({ where }),
      this.prisma.genre.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.country.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.content.aggregate({ where: { isPublished: true }, _min: { year: true }, _max: { year: true } }),
    ]);

    let data = await this.enrichCards(items, user?.id ?? null);
    if (query.rating_from) {
      data = data.filter((item) => (item.siteRating ?? 0) >= query.rating_from!);
    }

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
        hasNext: skip + data.length < total,
        hasPrev: page > 1,
      },
      filters: {
        genres,
        countries,
        yearRange: {
          min: yearRangeRaw._min.year,
          max: yearRangeRaw._max.year,
        },
      },
    };
  }

  async search(query: string, limit = 10, user: MaybeUser) {
    const items = await this.prisma.content.findMany({
      where: {
        isPublished: true,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { originalTitle: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: this.cardInclude(),
      take: Math.min(limit, 10),
    });

    return { data: await this.enrichCards(items, user?.id ?? null), total: items.length };
  }

  async getGenres() {
    return this.prisma.genre.findMany({ orderBy: { name: 'asc' } });
  }

  async getCountries() {
    return this.prisma.country.findMany({ orderBy: { name: 'asc' } });
  }

  async getNewReleases(type?: ContentType, limit = 10, user?: MaybeUser) {
    const items = await this.prisma.content.findMany({
      where: { isPublished: true, ...(type ? { type } : {}) },
      include: this.cardInclude(),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return { data: await this.enrichCards(items, user?.id ?? null) };
  }

  async getContentDetails(slug: string, user: MaybeUser) {
    const content = await this.prisma.content.findFirst({
      where: { slug, isPublished: true },
      include: {
        genres: { include: { genre: true } },
        countries: { include: { country: true } },
        persons: { include: { person: true }, orderBy: { sortOrder: 'asc' } },
        trailers: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!content) {
      throw new NotFoundException('Контент с данным slug не найден или не опубликован');
    }

    const [ratingSummary, reviewsCount, recensionsCount, myRating, isFavorite] = await Promise.all([
      this.getRatingSummary(content.id, user?.id ?? null),
      this.prisma.review.count({ where: { contentId: content.id, status: ReviewStatus.APPROVED } }),
      this.prisma.recension.count({ where: { contentId: content.id, status: 'APPROVED' } }),
      user ? this.prisma.rating.findUnique({ where: { userId_contentId: { userId: user.id, contentId: content.id } } }) : null,
      user ? this.prisma.favorite.findUnique({ where: { userId_contentId: { userId: user.id, contentId: content.id } } }) : null,
    ]);

    return {
      id: content.id,
      slug: content.slug,
      type: content.type,
      title: content.title,
      originalTitle: content.originalTitle,
      shortDescription: content.shortDescription,
      description: content.description,
      posterUrl: content.posterUrl,
      bannerUrl: content.bannerUrl,
      year: content.year,
      ageRating: content.ageRating,
      durationMinutes: content.durationMinutes,
      seriesInfo: this.makeSeriesInfo(content),
      genres: content.genres.map((item) => ({ id: item.genre.id, name: item.genre.name, slug: item.genre.slug })),
      countries: content.countries.map((item) => ({ id: item.country.id, name: item.country.name, code: item.country.code })),
      directors: content.persons
        .filter((item) => item.roleType === 'DIRECTOR')
        .map((item) => ({ id: item.person.id, fullName: item.person.fullName, photoUrl: item.person.photoUrl })),
      actors: content.persons
        .filter((item) => item.roleType === 'ACTOR')
        .map((item) => ({
          id: item.person.id,
          fullName: item.person.fullName,
          photoUrl: item.person.photoUrl,
          characterName: item.characterName,
        })),
      trailers: content.trailers.map((trailer) => ({
        id: trailer.id,
        title: trailer.title,
        provider: trailer.provider,
        videoUrl: trailer.videoUrl,
        previewImageUrl: trailer.previewImageUrl,
      })),
      ratings: ratingSummary,
      reviewStats: {
        reviewsCount,
        recensionsCount,
      },
      userFlags: user
        ? {
            isFavorite: Boolean(isFavorite),
            myRating: myRating?.score ?? null,
            canRate: !myRating,
            canReview: !myRating,
          }
        : undefined,
    };
  }

  async getSimilar(contentId: string, user: MaybeUser) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: { genres: true },
    });
    if (!content || !content.isPublished) {
      throw new NotFoundException('Контент не найден');
    }

    const genreIds = content.genres.map((item) => item.genreId);
    const items = await this.prisma.content.findMany({
      where: {
        id: { not: contentId },
        isPublished: true,
        type: content.type,
        year: { gte: content.year - 3, lte: content.year + 3 },
        ...(genreIds.length ? { genres: { some: { genreId: { in: genreIds } } } } : {}),
      },
      include: this.cardInclude(),
      take: 10,
    });

    return { data: await this.enrichCards(items, user?.id ?? null) };
  }

  async getRecommended(contentId: string, user: MaybeUser) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: { genres: true },
    });
    if (!content || !content.isPublished) {
      throw new NotFoundException('Контент не найден');
    }

    const genreIds = content.genres.map((item) => item.genreId);
    const candidates = await this.prisma.content.findMany({
      where: {
        id: { not: contentId },
        isPublished: true,
        ...(genreIds.length ? { genres: { some: { genreId: { in: genreIds } } } } : {}),
      },
      include: this.cardInclude(),
      take: 20,
    });

    const data = await this.enrichCards(candidates, user?.id ?? null);
    return {
      data: data.sort((a, b) => (b.siteRating ?? 0) - (a.siteRating ?? 0)).slice(0, 10),
    };
  }

  async getRatingSummary(contentId: string, userId: string | null) {
    const [aggregate, distributionRows, myRating] = await Promise.all([
      this.prisma.rating.aggregate({ where: { contentId }, _avg: { score: true }, _count: { _all: true } }),
      this.prisma.rating.groupBy({ by: ['score'], where: { contentId }, _count: { _all: true } }),
      userId ? this.prisma.rating.findUnique({ where: { userId_contentId: { userId, contentId } } }) : null,
    ]);

    const total = aggregate._count._all;
    const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } as Record<string, number>;
    for (const row of distributionRows) {
      distribution[String(row.score)] = total ? Math.round((row._count._all / total) * 100) : 0;
    }

    const content = await this.prisma.content.findUnique({ where: { id: contentId } });

    return {
      siteRating: aggregate._avg.score ? Number(aggregate._avg.score.toFixed(1)) : null,
      ratingsCount: total,
      distribution,
      imdbRating: content?.externalRatingImdb ? Number(content.externalRatingImdb) : null,
      kinopoiskRating: content?.externalRatingKinopoisk ? Number(content.externalRatingKinopoisk) : null,
      myRating: myRating?.score ?? null,
    };
  }

  private cardInclude() {
    return {
      genres: { include: { genre: true } },
    } satisfies Prisma.ContentInclude;
  }

  private resolveCatalogOrder(sort = 'popular'): Prisma.ContentOrderByWithRelationInput[] {
    switch (sort) {
      case 'year_desc':
        return [{ year: 'desc' }, { title: 'asc' }];
      case 'year_asc':
        return [{ year: 'asc' }, { title: 'asc' }];
      case 'title_asc':
        return [{ title: 'asc' }];
      case 'rating_desc':
        return [{ updatedAt: 'desc' }];
      case 'popular':
      default:
        return [{ isFeatured: 'desc' }, { updatedAt: 'desc' }];
    }
  }

  private async enrichCards(items: Array<Content & { genres: { genre: { id: string; name: string; slug: string } }[] }>, userId: string | null) {
    if (items.length === 0) {
      return [];
    }
    const ids = items.map((item) => item.id);
    const [ratings, favorites, myRatings] = await Promise.all([
      this.prisma.rating.groupBy({ by: ['contentId'], where: { contentId: { in: ids } }, _avg: { score: true }, _count: { _all: true } }),
      userId ? this.prisma.favorite.findMany({ where: { userId, contentId: { in: ids } } }) : [],
      userId ? this.prisma.rating.findMany({ where: { userId, contentId: { in: ids } } }) : [],
    ]);

    const ratingMap = new Map(ratings.map((item) => [item.contentId, { avg: item._avg.score, count: item._count._all }]));
    const favoriteSet = new Set(favorites.map((item) => item.contentId));
    const myRatingMap = new Map<string, number>(myRatings.map((item) => [item.contentId, item.score] as [string, number]));

    return items.map((item) => {
      const ratingInfo = ratingMap.get(item.id);
      return {
        id: item.id,
        slug: item.slug,
        type: item.type,
        title: item.title,
        originalTitle: item.originalTitle,
        posterUrl: item.posterUrl,
        year: item.year,
        ageRating: item.ageRating,
        genres: item.genres.map((genre) => ({ name: genre.genre.name, slug: genre.genre.slug })),
        siteRating: ratingInfo?.avg ? Number(Number(ratingInfo.avg).toFixed(1)) : null,
        imdbRating: item.externalRatingImdb ? Number(item.externalRatingImdb) : null,
        kinopoiskRating: item.externalRatingKinopoisk ? Number(item.externalRatingKinopoisk) : null,
        seriesInfo: this.makeSeriesInfo(item),
        isFavorite: userId ? favoriteSet.has(item.id) : undefined,
        myRating: userId ? myRatingMap.get(item.id) ?? null : undefined,
      };
    });
  }

  private makeSeriesInfo(item: Pick<Content, 'type' | 'seasonsCount' | 'episodesCount'>) {
    if (item.type !== ContentType.SERIES && !item.seasonsCount && !item.episodesCount) {
      return null;
    }
    const seasons = item.seasonsCount ? `${item.seasonsCount} сезона` : null;
    const episodes = item.episodesCount ? `${item.episodesCount} серий` : null;
    return [seasons, episodes].filter(Boolean).join(', ') || null;
  }
}
