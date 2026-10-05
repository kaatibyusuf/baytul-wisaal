import { IsIn } from "class-validator";

export class AvailabilityDto {
  @IsIn(["AVAILABLE", "PAUSED"])
  availability!: "AVAILABLE" | "PAUSED";
}
