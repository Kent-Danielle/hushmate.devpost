import { Transform } from 'class-transformer';
import { IsISO8601, IsString, Length } from 'class-validator';

export class CreateHeadsUpDto {
  // Trimmed, 1-200 characters.
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 200)
  text!: string;

  // ISO 8601 date-time with an offset; the "in the future" rule is checked in the service.
  @IsISO8601({ strict: true })
  at!: string;
}
