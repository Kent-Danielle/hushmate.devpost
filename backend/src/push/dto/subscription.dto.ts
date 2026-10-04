import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';

class SubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  auth!: string;
}

export class SubscribeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  endpoint!: string;

  @ValidateNested()
  @Type(() => SubscriptionKeysDto)
  keys!: SubscriptionKeysDto;
}

export class UnsubscribeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  endpoint!: string;
}
