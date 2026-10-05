import { IsIn, IsObject, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class StartSessionDto {
  @IsString()
  @Length(10, 60)
  activityId!: string;
}

/** Only signals the browser can see. Everything else is derived on the server. */
export const CLIENT_EVENT_TYPES = ["TAB_SWITCH", "WINDOW_BLUR", "LARGE_PASTE", "SCREEN_CAPTURE_SIGNAL", "LONG_INACTIVITY"] as const;

export class EventDto {
  @IsIn(CLIENT_EVENT_TYPES as unknown as string[])
  type!: (typeof CLIENT_EVENT_TYPES)[number];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SubmitAssessmentDto {
  @IsObject()
  parts!: Record<string, unknown>;
}

export class DecideReviewDto {
  @IsIn(["APPROVED", "FAILED", "CLARIFICATION_REQUESTED"])
  status!: "APPROVED" | "FAILED" | "CLARIFICATION_REQUESTED";

  /** Internal note for the audit trail. Never shown to the candidate. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
