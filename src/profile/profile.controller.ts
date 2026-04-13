import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeactivateAccountDto } from './dto/deactivate-account.dto';
import { ProfileService } from './profile.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile/me')
  getMe(@CurrentUser() user: { id: string; role: any }) {
    return this.profileService.getMe(user);
  }

  @Get('profile/reviews')
  getMyReviews(@CurrentUser() user: { id: string; role: any }, @Query() query: PaginationQueryDto) {
    return this.profileService.getMyReviews(user, query);
  }

  @Get('profile/ratings')
  getMyRatings(@CurrentUser() user: { id: string; role: any }, @Query() query: PaginationQueryDto) {
    return this.profileService.getMyRatings(user, query);
  }

  @Get('profile/favorites')
  getFavorites(
    @CurrentUser() user: { id: string; role: any },
    @Query() query: PaginationQueryDto,
    @Query('sort') sort?: 'newest' | 'oldest' | 'title_asc',
  ) {
    return this.profileService.getFavorites(user, { ...query, sort });
  }

  @Post('favorites/:contentId')
  addFavorite(@CurrentUser() user: { id: string; role: any }, @Param('contentId') contentId: string) {
    return this.profileService.addFavorite(user, contentId);
  }

  @Delete('favorites/:contentId')
  removeFavorite(@CurrentUser() user: { id: string; role: any }, @Param('contentId') contentId: string) {
    return this.profileService.removeFavorite(user, contentId);
  }

  @Patch('profile/password')
  changePassword(@CurrentUser() user: { id: string; role: any }, @Body() dto: ChangePasswordDto) {
    return this.profileService.changePassword(user, dto);
  }

  @Delete('profile/me')
  deactivateAccount(@CurrentUser() user: { id: string; role: any }, @Body() dto: DeactivateAccountDto) {
    return this.profileService.deactivateAccount(user, dto);
  }
}
