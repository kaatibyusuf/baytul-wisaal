import { Module } from "@nestjs/common";
import { MatchingModule } from "../matching/matching.module";
import { ProgrammeModule } from "../programme/programme.module";
import { AdminAuditController, AdminProgrammeController, AdminSettingsController, AdminUsersController } from "./admin.controller";
import { AuditAdminService } from "./audit-admin.service";
import { CurriculumService } from "./curriculum.service";
import { SettingsAdminService } from "./settings-admin.service";
import { UsersAdminService } from "./users-admin.service";

@Module({
  imports: [MatchingModule, ProgrammeModule],
  controllers: [AdminUsersController, AdminAuditController, AdminSettingsController, AdminProgrammeController],
  providers: [UsersAdminService, AuditAdminService, SettingsAdminService, CurriculumService],
})
export class AdminModule {}
