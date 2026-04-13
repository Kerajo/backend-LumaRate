import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateRecensionDto } from './dto/create-recension.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ContentService } from '../content/content.service';
import { ReviewStatus, UserRole } from '@prisma/client';

type CurrentUser = { id: string; role: UserRole };

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
  ) {}

  async createRating(contentId: string, user: CurrentUser, dto: CreateRatingDto) {
    await this.ensurePublishedContent(contentId);

    const existingRating = await this.prisma.rating.findUnique({
      where: { userId_contentId: { userId: user.id, contentId } },
    });
    if (existingRating) {
      throw new ConflictException('Пользователь уже оценил этот контент');
    }

    const rating = await this.prisma.rating.create({
      data: { userId: user.id, contentId, score: dto.score },
    });

    return {
      message: 'Оценка сохранена',
      rating: {
        id: rating.id,
        score: rating.score,
        createdAt: rating.createdAt,
      },
      ratingSummary: await this.contentService.getRatingSummary(contentId, user.id),
    };
  }

  async getRatingSummary(contentId: string, userId: string | null) {
    await this.ensurePublishedContent(contentId);
    return this.contentService.getRatingSummary(contentId, userId);
  }

  async getReviews(contentId: string, user: CurrentUser | null, query: PaginationQueryDto & { sort?: 'newest' | 'oldest' }) {
    await this.ensurePublishedContent(contentId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const orderBy = { createdAt: query.sort === 'oldest' ? 'asc' : 'desc' } as const;

    const [approvedReviews, totalApproved, ownHiddenReview] = await Promise.all([
      this.prisma.review.findMany({
        where: { contentId, status: ReviewStatus.APPROVED },
        include: { user: { select: { id: true, login: true, role: true } }, rating: true },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { contentId, status: ReviewStatus.APPROVED } }),
      user
        ? this.prisma.review.findFirst({
            where: { contentId, userId: user.id, status: { in: [ReviewStatus.PENDING, ReviewStatus.REJECTED] } },
            include: { user: { select: { id: true, login: true, role: true } }, rating: true },
          })
        : null,
    ]);

    const data = approvedReviews.map((review) => this.mapReviewCard(review, user));
    if (ownHiddenReview && page === 1 && !data.some((item) => item.id === ownHiddenReview.id)) {
      data.unshift(this.mapReviewCard(ownHiddenReview, user));
    }

    return {
      data,
      pagination: {
        page,
        limit,
        total: totalApproved + (ownHiddenReview && page === 1 ? 1 : 0),
        pages: Math.max(1, Math.ceil(totalApproved / limit)),
      },
    };
  }

  async createReview(contentId: string, user: CurrentUser, dto: CreateReviewDto) {
    await this.ensurePublishedContent(contentId);

    const existingRating = await this.prisma.rating.findUnique({
      where: { userId_contentId: { userId: user.id, contentId } },
    });
    if (existingRating) {
      throw new ConflictException('Пользователь уже оценивал / оставлял отзыв на этот контент');
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const rating = await tx.rating.create({
        data: { userId: user.id, contentId, score: dto.score },
      });
      return tx.review.create({
        data: {
          userId: user.id,
          contentId,
          ratingId: rating.id,
          text: dto.text,
          status: ReviewStatus.PENDING,
        },
      });
    });

    return {
      message: 'Отзыв отправлен на модерацию',
      review: {
        id: review.id,
        status: review.status,
        createdAt: review.createdAt,
      },
    };
  }

  async deleteReview(reviewId: string, user: CurrentUser) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Отзыв не найден');
    }
    const canDelete = user.role === UserRole.ADMIN || review.userId === user.id;
    if (!canDelete) {
      throw new ForbiddenException('Недостаточно прав');
    }

    await this.prisma.review.delete({ where: { id: reviewId } });
    return { message: 'Отзыв удалён' };
  }

  async updateReviewDisabled() {
    throw new NotImplementedException('Редактирование отзывов будет доступно в v1.1');
  }

  async getRecensions(contentId: string, query: PaginationQueryDto) {
    await this.ensurePublishedContent(contentId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.recension.findMany({
        where: { contentId, status: 'APPROVED' },
        include: { expert: { select: { id: true, login: true, role: true } } },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.recension.count({ where: { contentId, status: 'APPROVED' } }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id,
        title: item.title,
        author: item.expert,
        text: item.text,
        status: item.status,
        publishedAt: item.publishedAt,
      })),
      pagination: { page, total },
    };
  }

  async createRecension(contentId: string, user: CurrentUser, dto: CreateRecensionDto) {
    await this.ensurePublishedContent(contentId);
    const recension = await this.prisma.recension.create({
      data: {
        expertUserId: user.id,
        contentId,
        title: dto.title,
        text: dto.text,
        status: 'PENDING',
      },
    });

    return {
      message: 'Рецензия отправлена на модерацию',
      recension: {
        id: recension.id,
        status: recension.status,
        createdAt: recension.createdAt,
      },
    };
  }

  private async ensurePublishedContent(contentId: string) {
    const content = await this.prisma.content.findFirst({ where: { id: contentId, isPublished: true } });
    if (!content) {
      throw new NotFoundException('Контент не найден');
    }
    return content;
  }

  private mapReviewCard(
    review: {
      id: string;
      userId: string;
      text: string;
      status: ReviewStatus;
      createdAt: Date;
      user: { id: string; login: string; role: UserRole };
      rating: { score: number };
    },
    currentUser: CurrentUser | null,
  ) {
    const isMine = currentUser?.id === review.userId;
    return {
      id: review.id,
      author: review.user,
      rating: review.rating.score,
      text: review.text,
      status: review.status,
      createdAt: review.createdAt,
      isMine,
      canDelete: currentUser ? currentUser.role === UserRole.ADMIN || isMine : false,
    };
  }
}
