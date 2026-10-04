import { IsIn, IsOptional } from 'class-validator';
import { SCOPES, type Scope } from './update-quiet-time.dto.js';

export class DeleteQuietTimeQuery {
  /** Defaults to "day" when omitted. */
  @IsOptional()
  @IsIn(SCOPES)
  scope?: Scope;
}
