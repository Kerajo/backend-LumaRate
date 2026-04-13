import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ContentType, TrailerProvider, UserRole } from "@prisma/client";

class TrailerDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsEnum(TrailerProvider)
  provider!: TrailerProvider;

  @IsUrl()
  videoUrl!: string;

  @IsOptional()
  @IsString()
  previewImageUrl?: string;
}

export class CreateContentDto {
  @IsEnum(ContentType)
  type!: ContentType;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  slug!: string;

  @Type(() => Number)
  @IsInt()
  year!: number;

  @IsOptional()
  @IsString()
  originalTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  posterUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsString()
  ageRating?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  durationMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seasonsCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  episodesCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(10)
  externalRatingImdb?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(10)
  externalRatingKinopoisk?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  genreIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  countryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  directorIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  actorIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrailerDto)
  trailers?: TrailerDto[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
