import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SignUpDto {
  @Transform(trim)
  @IsString()
  @Length(1, 30)
  name!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // Never trimmed.
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
