import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole, UserStatus } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { AppUserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AdminService } from "./admin.service";
import { CreateContentDto } from "./dto/create-content.dto";
import { CreateCountryDto } from "./dto/create-country.dto";
import { CreateGenreDto } from "./dto/create-genre.dto";
import { CreatePersonDto } from "./dto/create-person.dto";
import { UpdateContentDto } from "./dto/update-content.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";

@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppUserRole.ADMIN)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}
  
  @Get("contents")
  listContents(
    @Query() query: PaginationQueryDto,
    @Query("type") type?: string,
    @Query("published") published?: string,
    @Query("search") search?: string,
  ) {
    return this.adminService.listContents({ ...query, type, published, search });
  }

  @Post("contents")
  createContent(@CurrentUser() user: any, @Body() dto: CreateContentDto) {
    return this.adminService.createContent(user, dto);
  }

  @Get("genres")
  listGenres() {
    return this.adminService.listGenres();
  }

  @Post("genres")
  createGenre(@Body() dto: CreateGenreDto) {
    return this.adminService.createGenre(dto);
  }

  @Patch("contents/:id")
  updateContent(@Param("id") id: string, @Body() dto: UpdateContentDto) {
    return this.adminService.updateContent(id, dto);
  }

  @Delete("contents/:id")
  deleteContent(@Param("id") id: string) {
    return this.adminService.deleteContent(id);
  }

  @Get("users")
  listUsers(
    @Query() query: PaginationQueryDto,
    @Query("role") role?: UserRole,
    @Query("status") status?: UserStatus,
    @Query("search") search?: string,
  ) {
    return this.adminService.listUsers({ ...query, role, status, search });
  }

  @Patch("users/:id/role")
  updateUserRole(@Param("id") id: string, @Body() dto: UpdateUserRoleDto) {
    return this.adminService.updateUserRole(id, dto);
  }

  @Delete("users/:id")
  deleteUser(@Param("id") id: string) {
    return this.adminService.deactivateUser(id);
  }

  @Patch("genres/:id")
  updateGenre(@Param("id") id: string, @Body() dto: Partial<CreateGenreDto>) {
    return this.adminService.updateGenre(id, dto);
  }

  @Delete("genres/:id")
  deleteGenre(@Param("id") id: string) {
    return this.adminService.deleteGenre(id);
  }

  @Get("countries")
  listCountries() {
    return this.adminService.listCountries();
  }

  @Post("countries")
  createCountry(@Body() dto: CreateCountryDto) {
    return this.adminService.createCountry(dto);
  }

  @Patch("countries/:id")
  updateCountry(
    @Param("id") id: string,
    @Body() dto: Partial<CreateCountryDto>,
  ) {
    return this.adminService.updateCountry(id, dto);
  }

  @Delete("countries/:id")
  deleteCountry(@Param("id") id: string) {
    return this.adminService.deleteCountry(id);
  }

  @Get("persons")
  listPersons() {
    return this.adminService.listPersons();
  }

  @Post("persons")
  createPerson(@Body() dto: CreatePersonDto) {
    return this.adminService.createPerson(dto);
  }

  @Patch("persons/:id")
  updatePerson(@Param("id") id: string, @Body() dto: Partial<CreatePersonDto>) {
    return this.adminService.updatePerson(id, dto);
  }

  @Delete("persons/:id")
  deletePerson(@Param("id") id: string) {
    return this.adminService.deletePerson(id);
  }
}
