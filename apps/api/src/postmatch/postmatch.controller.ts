import { Body, Controller, Get, HttpCode, Param, Post, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Role } from "@prisma/client";
import { AuthUser, CurrentUser, Roles } from "../common/decorators";
import { CompatReviewService } from "./compat-review.service";
import { CompatDecisionDto, SaveExpectationsDto, SaveResponsesDto } from "./dto";
import { PostMatchService } from "./postmatch.service";

@ApiTags("matches")
@Controller("matches")
export class PostMatchController {
  constructor(private readonly postMatch: PostMatchService) {}

  @Get(":id")
  view(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.postMatch.view(user.id, id);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Put(":id/expectations")
  expectations(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: SaveExpectationsDto) {
    return this.postMatch.saveExpectations(user.id, id, dto);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Put(":id/responses")
  responses(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: SaveResponsesDto) {
    return this.postMatch.saveResponses(user.id, id, dto);
  }
}

@ApiTags("admin")
@Roles(Role.MODERATOR, Role.ADMIN)
@Controller("admin/compatibility")
export class CompatReviewController {
  constructor(private readonly reviews: CompatReviewService) {}

  @Get()
  list() {
    return this.reviews.list();
  }

  @Get(":matchId")
  detail(@Param("matchId") matchId: string) {
    return this.reviews.detail(matchId);
  }

  @HttpCode(200)
  @Post(":matchId/decision")
  decide(@CurrentUser() user: AuthUser, @Param("matchId") matchId: string, @Body() dto: CompatDecisionDto) {
    return this.reviews.decide(user, matchId, dto);
  }
}
