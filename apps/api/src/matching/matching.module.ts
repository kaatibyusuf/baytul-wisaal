import { Module } from "@nestjs/common";
import { MatchesController, MatchmakingAdminController } from "./matching.controller";
import { MatchmakingService } from "./matchmaking.service";

@Module({ controllers: [MatchesController, MatchmakingAdminController], providers: [MatchmakingService] })
export class MatchingModule {}
