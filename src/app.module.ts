import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { ContentModule } from "./content/content.module";
import { ModerationModule } from "./moderation/moderation.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProfileModule } from "./profile/profile.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { UploadsModule } from "./uploads/uploads.module";

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "uploads"),
      serveRoot: "/uploads",
    }),
    PrismaModule,
    AuthModule,
    ContentModule,
    ReviewsModule,
    ProfileModule,
    ModerationModule,
    AdminModule,
    UploadsModule,
  ],
})
export class AppModule {}
