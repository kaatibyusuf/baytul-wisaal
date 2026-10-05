import { Module } from "@nestjs/common";
import { ProgrammeModule } from "../programme/programme.module";
import { AssessmentEvaluatorService } from "./ai/evaluator.service";
import { providersFromEnv } from "./ai/factory";
import { LLM_PROVIDERS } from "./ai/types";
import { AssessmentController } from "./assessment.controller";
import { AssessmentService } from "./assessment.service";
import { EvaluationService } from "./evaluation.service";
import { ReviewController } from "./review.controller";
import { ReviewService } from "./review.service";

@Module({
  imports: [ProgrammeModule],
  controllers: [AssessmentController, ReviewController],
  providers: [
    AssessmentService,
    EvaluationService,
    ReviewService,
    AssessmentEvaluatorService,
    { provide: LLM_PROVIDERS, useFactory: () => providersFromEnv() },
  ],
})
export class AssessmentModule {}
