import { Transform } from "class-transformer";
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from "class-validator";
import { Gender, MaritalStatus } from "@prisma/client";

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

/** Length rather than composition rules (NIST guidance). Upper bound protects the hasher. */
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

export class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN, { message: `Password must be at least ${PASSWORD_MIN} characters.` })
  @MaxLength(PASSWORD_MAX)
  password!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 120)
  fullName!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  preferredName?: string;

  @IsEnum(Gender)
  gender!: Gender;

  /** ISO date, e.g. 1996-04-23. Age is verified server-side. */
  @IsDateString({ strict: true })
  dateOfBirth!: string;

  @IsEnum(MaritalStatus)
  maritalStatus!: MaritalStatus;
}

export class TokenDto {
  @IsString()
  @Length(20, 200)
  token!: string;
}

export class EmailDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @Length(20, 200)
  token!: string;

  @IsString()
  @MinLength(PASSWORD_MIN, { message: `Password must be at least ${PASSWORD_MIN} characters.` })
  @MaxLength(PASSWORD_MAX)
  password!: string;
}
