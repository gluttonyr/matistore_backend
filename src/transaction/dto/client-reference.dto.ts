import { IsNotEmpty, IsString } from 'class-validator';

export class ClientReferenceDto {
  @IsString()
  @IsNotEmpty()
  referencePaiement!: string;

  @IsString()
  @IsNotEmpty()
  notificationBrute!: string;
}
