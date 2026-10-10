import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Role } from "@prisma/client";
import type { Response } from "express";
import { AuthUser, CurrentUser, Roles } from "../common/decorators";
import { AuditAdminService } from "./audit-admin.service";
import { CurriculumService } from "./curriculum.service";
import { ExtendDto, ImportDto, ReasonDto, RoleDto, SettingDto, StatusDto } from "./dto";
import { SettingsAdminService } from "./settings-admin.service";
import { UsersAdminService } from "./users-admin.service";

@ApiTags("admin")
@Roles(Role.ADMIN)
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly users: UsersAdminService) {}

  @Get()
  list(@Query("q") q?: string, @Query("status") status?: string, @Query("role") role?: string, @Query("page") page?: string) {
    return this.users.list({ q, status, role, page });
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.users.detail(id);
  }

  @HttpCode(200)
  @Post(":id/status")
  status(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: StatusDto) {
    return this.users.setStatus(actor, id, dto.status, dto.reason);
  }

  @HttpCode(200)
  @Post(":id/verify-email")
  verify(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: ReasonDto) {
    return this.users.verifyEmail(actor, id, dto.reason);
  }

  @HttpCode(200)
  @Post(":id/programme/extend")
  extend(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: ExtendDto) {
    return this.users.extendProgramme(actor, id, dto.days, dto.reason);
  }

  /** Only a super administrator can change roles. */
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(200)
  @Post(":id/role")
  role(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: RoleDto) {
    return this.users.setRole(actor, id, dto.role, dto.reason);
  }
}

@ApiTags("admin")
@Roles(Role.ADMIN)
@Controller("admin/audit")
export class AdminAuditController {
  constructor(private readonly audit: AuditAdminService) {}

  @Get()
  list(@Query("action") action?: string, @Query("actorId") actorId?: string, @Query("targetId") targetId?: string, @Query("page") page?: string) {
    return this.audit.list({ action, actorId, targetId, page });
  }
}

@ApiTags("admin")
@Roles(Role.ADMIN)
@Controller("admin/settings")
export class AdminSettingsController {
  constructor(private readonly settings: SettingsAdminService) {}

  @Get()
  list() {
    return this.settings.list();
  }

  @HttpCode(200)
  @Put(":key")
  update(@CurrentUser() actor: AuthUser, @Param("key") key: string, @Body() dto: SettingDto) {
    return this.settings.update(actor, key, dto.value, dto.reason);
  }
}

@ApiTags("admin")
@Roles(Role.ADMIN)
@Controller("admin/programme")
export class AdminProgrammeController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get("export")
  async export(@Res({ passthrough: true }) res: Response) {
    res.setHeader("Cache-Control", "no-store");
    return this.curriculum.export();
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("import")
  import(@CurrentUser() actor: AuthUser, @Body() dto: ImportDto) {
    return this.curriculum.import(actor, dto.curriculum, dto.dryRun ?? false);
  }
}
