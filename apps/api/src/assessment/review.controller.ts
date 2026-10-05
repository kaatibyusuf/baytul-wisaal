import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { AuthUser, CurrentUser, Roles } from "../common/decorators";
import { DecideReviewDto } from "./dto";
import { ReviewService } from "./review.service";

@ApiTags("admin")
@Roles(Role.MODERATOR, Role.ADMIN)
@Controller("admin/reviews")
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Get()
  list() {
    return this.reviews.list();
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.reviews.detail(id);
  }

  @HttpCode(200)
  @Post(":id/decision")
  decide(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: DecideReviewDto) {
    return this.reviews.decide(user, id, dto);
  }
}
