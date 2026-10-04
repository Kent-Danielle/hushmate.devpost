import { IsUUID } from 'class-validator';

export class CreateNudgeDto {
  @IsUUID()
  recipientId!: string;
}
