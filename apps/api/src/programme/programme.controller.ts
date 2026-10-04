import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthUser, CurrentUser } from "../common/decorators";
import { SubmitDto } from "./dto";
import { ProgrammeService } from "./programme.service";

@ApiTags("programme")
@Controller("programme")
export class ProgrammeController {
  constructor(private readonly programme: ProgrammeService) {}

  @Get()
  summary(@CurrentUser() user: AuthUser) {
    return this.programme.summary(user.id);
  }

  @HttpCode(200)
  @Post("enroll")
  enroll(@CurrentUser() user: AuthUser) {
    return this.programme.enroll(user.id);
  }

  @Get("days/:dayNumber")
  day(@CurrentUser() user: AuthUser, @Param("dayNumber", ParseIntPipe) dayNumber: number) {
    return this.programme.dayView(user.id, dayNumber);
  }

  @Get("activities/:id")
  activity(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.programme.activityView(user.id, id);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("activities/:id/complete")
  complete(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.programme.completeLesson(user.id, id);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("activities/:id/submit")
  submit(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: SubmitDto) {
    return this.programme.submit(user.id, id, dto);
  }
}
