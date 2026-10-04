import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class CreateHouseDto {
  // Trimmed, 2-30 characters, no whitespace and no '#' (the '#' separates the code in `Name#123456`).
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 30)
  @Matches(/^[^\s#]+$/, { message: 'name must not contain spaces or #' })
  name!: string;
}
