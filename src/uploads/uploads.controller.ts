import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { randomUUID } from "crypto";
import { diskStorage } from "multer";
import { extname } from "path";
import { Roles } from "../common/decorators/roles.decorator";
import { AppUserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";

@ApiTags("Uploads")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppUserRole.ADMIN, AppUserRole.MODERATOR)
@Controller("upload")
export class UploadsController {
  @Post()
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads",
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          const filename = randomUUID() + ext;
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(
            new BadRequestException(
              "Разрешены только изображения (jpg, jpeg, png, gif, webp)",
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException("Файл не загружен или неверный формат");
    }
    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol || "http";
    return {
      url: `${protocol}://${host}/uploads/${file.filename}`,
    };
  }
}
