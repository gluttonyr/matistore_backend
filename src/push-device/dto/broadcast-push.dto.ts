import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BroadcastPushDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;
}
