import { Module } from "@nestjs/common";
import { MatchingModule } from "../matching/matching.module";
import { CompatReviewService } from "./compat-review.service";
import { CompatReviewController, PostMatchController } from "./postmatch.controller";
import { PostMatchService } from "./postmatch.service";

@Module({
  imports: [MatchingModule],
  controllers: [PostMatchController, CompatReviewController],
  providers: [PostMatchService, CompatReviewService],
})
export class PostMatchModule {}
