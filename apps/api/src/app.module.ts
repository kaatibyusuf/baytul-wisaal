import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "./audit/audit.module";
import { AssessmentModule } from "./assessment/assessment.module";
import { AuthModule } from "./auth/auth.module";
import { SessionAuthGuard } from "./auth/guards";
import { OriginGuard } from "./common/origin.guard";
import { RolesGuard } from "./common/roles.guard";
import { EmailModule } from "./email/email.module";
import { HealthModule } from "./health/health.module";
import { MatchingModule } from "./matching/matching.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PostMatchModule } from "./postmatch/postmatch.module";
import { PreferencesModule } from "./preferences/preferences.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProfileModule } from "./profile/profile.module";
import { ProgrammeModule } from "./programme/programme.module";
import { SettingsModule } from "./settings/settings.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Baseline rate limit for every route; auth routes set stricter limits (PRD section 35).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    SettingsModule,
    EmailModule,
    AuthModule,
    UsersModule,
    ProfileModule,
    ProgrammeModule,
    AssessmentModule,
    PreferencesModule,
    MatchingModule,
    PostMatchModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [
    // Guard order matters: rate limit, then origin check, then session, then role.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
