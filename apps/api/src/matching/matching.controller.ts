import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Role } from "@prisma/client";
import { AuthUser, CurrentUser, Roles } from "../common/decorators";
import { ExcludePairDto, RunMatchmakingDto, WithdrawDto } from "./dto";
import { MatchmakingService } from "./matchmaking.service";

@ApiTags("matches")
@Controller("matches")
export class MatchesController {
  constructor(private readonly matchmaking: MatchmakingService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.matchmaking.listForUser(user.id);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(":id/withdraw")
  withdraw(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: WithdrawDto) {
    return this.matchmaking.withdraw(user.id, id, dto.reason);
  }
}

@ApiTags("admin")
@Roles(Role.ADMIN)
@Controller("admin/matchmaking")
export class MatchmakingAdminController {
  constructor(private readonly matchmaking: MatchmakingService) {}

  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("run")
  run(@CurrentUser() user: AuthUser, @Body() dto: RunMatchmakingDto) {
    return this.matchmaking.run(user, dto.dryRun ?? false);
  }

  @HttpCode(200)
  @Post("exclusions")
  exclude(@CurrentUser() user: AuthUser, @Body() dto: ExcludePairDto) {
    return this.matchmaking.excludePair(user, dto.emailA, dto.emailB, dto.reason);
  }
}
