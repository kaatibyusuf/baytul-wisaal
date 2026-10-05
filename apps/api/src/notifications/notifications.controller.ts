import { Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser } from "../common/decorators";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  @HttpCode(200)
  @Post("read")
  read(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }
}
