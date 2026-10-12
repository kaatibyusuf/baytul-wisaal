import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationDispatcher } from "./dispatcher.service";
import { NotificationsService } from "./notifications.service";

@Module({ controllers: [NotificationsController], providers: [NotificationsService, NotificationDispatcher], exports: [NotificationDispatcher] })
export class NotificationsModule {}
