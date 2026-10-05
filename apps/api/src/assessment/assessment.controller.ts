import { Body, Controller, Get, Headers, HttpCode, Param, Post, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { AuthUser, CurrentUser } from "../common/decorators";
import { AssessmentService } from "./assessment.service";
import { EventDto, StartSessionDto, SubmitAssessmentDto } from "./dto";

const TOKEN = "x-assessment-token";
const perMinute = (limit: number) => ({ default: { limit, ttl: 60_000 } });

@ApiTags("assessments")
@Controller("assessments")
export class AssessmentController {
  constructor(private readonly assessments: AssessmentService) {}

  @HttpCode(200)
  @Throttle(perMinute(10))
  @Post("sessions")
  start(@CurrentUser() user: AuthUser, @Body() dto: StartSessionDto, @Res({ passthrough: true }) res: Response) {
    res.setHeader("Cache-Control", "no-store");
    return this.assessments.start(user.id, dto.activityId);
  }

  /** Never cached: the scenario must not be stored by browsers or proxies. */
  @Throttle(perMinute(30))
  @Get("sessions/:id")
  question(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Headers(TOKEN) token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    return this.assessments.question(user.id, id, token);
  }

  @HttpCode(200)
  @Throttle(perMinute(60))
  @Post("sessions/:id/events")
  event(@CurrentUser() user: AuthUser, @Param("id") id: string, @Headers(TOKEN) token: string | undefined, @Body() dto: EventDto) {
    return this.assessments.recordEvent(user.id, id, token, dto);
  }

  @HttpCode(200)
  @Throttle(perMinute(5))
  @Post("sessions/:id/submit")
  submit(@CurrentUser() user: AuthUser, @Param("id") id: string, @Headers(TOKEN) token: string | undefined, @Body() dto: SubmitAssessmentDto) {
    return this.assessments.submit(user.id, id, token, dto.parts);
  }

  @Get("sessions/:id/status")
  status(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.assessments.status(user.id, id);
  }
}
