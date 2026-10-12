import { IsNumber, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class AddPlayerDepositDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  @Max(1_000_000_000_000)
  summa!: number;

  @IsString()
  @IsNotEmpty()
  lng!: string;
}
