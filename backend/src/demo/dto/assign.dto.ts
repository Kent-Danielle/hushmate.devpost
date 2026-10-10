import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, MaxLength } from 'class-validator';

export class AssignDto {
  /** The demo account this browser was given last time, so a refresh keeps the same one. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  preferredEmail?: string;
}
