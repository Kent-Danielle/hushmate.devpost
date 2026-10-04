import { IsIn, IsInt, Max, Min } from 'class-validator';

export const SCOPES = ['day', 'set'] as const;
export type Scope = (typeof SCOPES)[number];

export class UpdateQuietTimeDto {
  @IsInt()
  @Min(0)
  @Max(1425)
  startMinute!: number;

  @IsInt()
  @Min(0)
  @Max(1425)
  endMinute!: number;

  @IsIn(SCOPES)
  scope!: Scope;
}
