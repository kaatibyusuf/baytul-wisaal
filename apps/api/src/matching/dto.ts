import { Transform } from "class-transformer";
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

const lower = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value);

export class RunMatchmakingDto {
  /** Preview the pairs without creating any matches. */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class ExcludePairDto {
  @Transform(lower) @IsEmail() emailA!: string;
  @Transform(lower) @IsEmail() emailB!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class WithdrawDto {
  /** Private. Never shown to the other person. */
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
