import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class SubmitDto {
  /** Reflection text. */
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  text?: string;

  /** Quiz answers: the chosen option index for each question, in order. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  answers?: number[];
}
