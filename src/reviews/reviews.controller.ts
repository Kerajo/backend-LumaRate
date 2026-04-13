import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AppUserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateRatingDto } from './dto/create-rating.dto';
import { CreateRecensionDto } from './dto/create-recension.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('contents/:id/rating')
  createRating(@Param('id') id: string, @CurrentUser() user: { id: string; role: any }, @Body() dto: CreateRatingDto) {
    return this.reviewsService.createRating(id, user, dto);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('contents/:id/rating-summary')
  getRatingSummary(@Param('id') id: string, @CurrentUser() user: { id: string } | null) {
    return this.reviewsService.getRatingSummary(id, user?.id ?? null);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('contents/:id/reviews')
  getReviews(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: any } | null,
    @Query() query: PaginationQueryDto,
    @Query('sort') sort?: 'newest' | 'oldest',
  ) {
    return this.reviewsService.getReviews(id, user, { ...query, sort });
  }

  @UseGuards(JwtAuthGuard)
  @Post('contents/:id/reviews')
  createReview(@Param('id') id: string, @CurrentUser() user: { id: string; role: any }, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(id, user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('reviews/:id')
  deleteReview(@Param('id') id: string, @CurrentUser() user: { id: string; role: any }) {
    return this.reviewsService.deleteReview(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reviews/:id')
  updateReviewDisabled() {
    return this.reviewsService.updateReviewDisabled();
  }

  @Get('contents/:id/recensions')
  getRecensions(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.reviewsService.getRecensions(id, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppUserRole.EXPERT)
  @Post('contents/:id/recensions')
  createRecension(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: any },
    @Body() dto: CreateRecensionDto,
  ) {
    return this.reviewsService.createRecension(id, user, dto);
  }
}
