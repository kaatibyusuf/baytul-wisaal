import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class SaveExpectationsDto {
  /** Checked item by item on the server. */
  @IsArray()
  @ArrayMaxSize(60)
  items!: unknown[];

  /** false saves a draft. true finalises it, after which it cannot be edited. */
  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

export class SaveResponsesDto {
  @IsArray()
  @ArrayMaxSize(60)
  responses!: unknown[];

  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

export class CompatDecisionDto {
  @IsIn(["PASS", "CLOSE"])
  decision!: "PASS" | "CLOSE";

  /** Internal note for the audit trail. Never shown to either person. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
