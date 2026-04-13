import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ContentModule } from "./content/content.module";
import { ProfileModule } from "./profile/profile.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { ModerationModule } from "./moderation/moderation.module";
import { AdminModule } from "./admin/admin.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ContentModule,
    ReviewsModule,
    ProfileModule,
    ModerationModule,
    AdminModule,
  ],
})
export class AppModule {}
