import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class CreateUserDto {
  // At least one of nom / prenom is required (checked in UtilisateurService.create).
  @IsOptional()
  @IsString()
  nom!: string;

  @IsOptional()
  @IsString()
  prenom!: string;

  @IsNotEmpty({ message: 'Le username est requis' })
  @IsString()
  @MinLength(3, { message: 'Le username doit contenir au moins 3 caractères' })
  username!: string;

  @IsNotEmpty({ message: 'L\'email est requis' })
  @IsEmail({}, { message: 'L\'email est invalide' })
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password?: string;

  @IsNotEmpty({ message: 'Le téléphone est requis' })
  @IsString()
  telephone!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  active?: boolean;

  @IsOptional()
  @IsString()
  googleId?: string;

  @IsOptional()
  @IsString()
  appleId?: string;

  @IsOptional()
  @IsString()
  identityToken?: string;

  @IsOptional()
  @IsString()
  provider?: string;
}

