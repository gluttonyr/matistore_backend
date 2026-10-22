import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class SmsItemDto {
  @IsString()
  @MaxLength(150)
  expediteur!: string;

  @IsString()
  @MaxLength(2000)
  corps!: string;

  @IsInt()
  @Min(0)
  receivedAt!: number;
}

export class SmsBatchDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SmsItemDto)
  sms!: SmsItemDto[];
}
