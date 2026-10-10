import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { Role } from "@prisma/client";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

/** Every sensitive change records why (PRD section 36). */
export class ReasonDto {
  @Transform(trim)
  @IsString()
  @Length(5, 500, { message: "Please give a reason of at least 5 characters." })
  reason!: string;
}

export class StatusDto extends ReasonDto {
  @IsIn(["ACTIVE", "RESTRICTED", "SUSPENDED"])
  status!: "ACTIVE" | "RESTRICTED" | "SUSPENDED";
}

export class RoleDto extends ReasonDto {
  @IsEnum(Role)
  role!: Role;
}

export class ExtendDto extends ReasonDto {
  @IsInt()
  @Min(1)
  @Max(90)
  days!: number;
}

export class SettingDto extends ReasonDto {
  @IsNumber()
  value!: number;
}

export class ImportDto {
  @IsObject()
  curriculum!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
