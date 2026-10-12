import { Module } from "@nestjs/common";
import { MatchesController, MatchmakingAdminController } from "./matching.controller";
import { MatchingScheduler } from "./matching-scheduler.service";
import { MatchmakingService } from "./matchmaking.service";

@Module({ controllers: [MatchesController, MatchmakingAdminController], providers: [MatchmakingService, MatchingScheduler], exports: [MatchmakingService] })
export class MatchingModule {}
