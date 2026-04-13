import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RecensionStatus, ReviewStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AppUserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ModerationReasonDto } from './dto/moderation-reason.dto';
import { ModerationService } from './moderation.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppUserRole.MODERATOR)
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('reviews')
  getReviews(@Query('status') status: ReviewStatus | undefined, @Query() query: PaginationQueryDto) {
    return this.moderationService.getReviewsQueue(status ?? ReviewStatus.PENDING, query);
  }

  @Post('reviews/:id/approve')
  approveReview(@Param('id') id: string, @CurrentUser() user: { id: string; role: any }) {
    return this.moderationService.approveReview(id, user);
  }

  @Post('reviews/:id/reject')
  rejectReview(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: any },
    @Body() dto: ModerationReasonDto,
  ) {
    return this.moderationService.rejectReview(id, user, dto);
  }

  @Get('recensions')
  getRecensions(@Query('status') status: RecensionStatus | undefined, @Query() query: PaginationQueryDto) {
    return this.moderationService.getRecensionsQueue(status ?? RecensionStatus.PENDING, query);
  }

  @Post('recensions/:id/approve')
  approveRecension(@Param('id') id: string, @CurrentUser() user: { id: string; role: any }) {
    return this.moderationService.approveRecension(id, user);
  }

  @Post('recensions/:id/reject')
  rejectRecension(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: any },
    @Body() dto: ModerationReasonDto,
  ) {
    return this.moderationService.rejectRecension(id, user, dto);
  }

  @Get('stats')
  getStats() {
    return this.moderationService.getStats();
  }
}
