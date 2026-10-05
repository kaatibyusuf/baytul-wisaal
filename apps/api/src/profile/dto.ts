import { Transform, Type } from "class-transformer";
import { IsEnum, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { MaritalStatus } from "@prisma/client";

/** Empty strings clear a field. */
const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === "string" ? (value.trim() === "" ? null : value.trim()) : value;

export class ReligiousInfoDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(200)
  practice?: string | null;

  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(200)
  quranStudy?: string | null;

  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(1000)
  notes?: string | null;
}

export class FamilyInfoDto {
  @IsOptional() @IsInt() @Min(0) @Max(30)
  siblings?: number;

  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(200)
  parents?: string | null;

  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(1000)
  notes?: string | null;
}

/**
 * Only these fields can be changed by the user. Full name, gender and date of birth are
 * fixed at registration and can only be corrected by an administrator.
 */
export class UpdateProfileDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(60)
  preferredName?: string | null;

  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(120)
  location?: string | null;

  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(80)
  country?: string | null;

  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(80)
  region?: string | null;

  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(80)
  nationality?: string | null;

  @IsOptional()
  @Transform(blankToNull)
  @Matches(/^\+?[0-9 ()-]{7,20}$/, { message: "Enter a valid phone number." })
  phone?: string | null;

  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(160)
  education?: string | null;

  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(160)
  occupation?: string | null;

  @IsOptional() @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @IsOptional() @IsObject() @ValidateNested() @Type(() => ReligiousInfoDto)
  religiousInfo?: ReligiousInfoDto;

  @IsOptional() @IsObject() @ValidateNested() @Type(() => FamilyInfoDto)
  familyInfo?: FamilyInfoDto;
}
