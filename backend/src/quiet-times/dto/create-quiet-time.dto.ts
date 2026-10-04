import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsInt, Max, Min } from 'class-validator';

const STEP = 15;
const multipleOf15 = (n: number) => Number.isInteger(n) && n % STEP === 0;

export class CreateQuietTimeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days!: number[];

  @IsInt()
  @Min(0)
  @Max(1425)
  startMinute!: number;

  @IsInt()
  @Min(0)
  @Max(1425)
  endMinute!: number;

  static stepOk(n: number): boolean {
    return multipleOf15(n);
  }
}
