import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ContentType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { ContentService } from './content.service';

@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get('home')
  getHome(@CurrentUser() user: { id: string; role: any } | null) {
    return this.contentService.getHome(user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('catalog')
  getCatalog(@Query() query: CatalogQueryDto, @CurrentUser() user: { id: string; role: any } | null) {
    return this.contentService.getCatalog(query, user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('search')
  search(
    @Query('query') query: string,
    @Query('limit') limit: number | undefined,
    @CurrentUser() user: { id: string; role: any } | null,
  ) {
    return this.contentService.search(query, limit ? Number(limit) : 10, user);
  }

  @Get('genres')
  getGenres() {
    return this.contentService.getGenres();
  }

  @Get('countries')
  getCountries() {
    return this.contentService.getCountries();
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('contents/new-releases')
  getNewReleases(
    @Query('type') type: ContentType | undefined,
    @Query('limit') limit: number | undefined,
    @CurrentUser() user: { id: string; role: any } | null,
  ) {
    return this.contentService.getNewReleases(type, limit ? Number(limit) : 10, user ?? undefined);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('contents/:id/similar')
  getSimilar(@Param('id') id: string, @CurrentUser() user: { id: string; role: any } | null) {
    return this.contentService.getSimilar(id, user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('contents/:id/recommended')
  getRecommended(@Param('id') id: string, @CurrentUser() user: { id: string; role: any } | null) {
    return this.contentService.getRecommended(id, user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('contents/:slug')
  getDetails(@Param('slug') slug: string, @CurrentUser() user: { id: string; role: any } | null) {
    return this.contentService.getContentDetails(slug, user);
  }
}
