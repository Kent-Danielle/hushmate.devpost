import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

export class SignInDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MaxLength(254)
  email!: string;

  // Loose on purpose: every failure is the same 401. The cap bounds the hashing input.
  @IsString()
  @MaxLength(128)
  password!: string;
}
