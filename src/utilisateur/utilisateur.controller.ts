import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UtilisateurService } from './utilisateur.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { ApiResponse } from '../common/api-response.interface';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from './enums/user-role.enum';
import { UploadService } from 'src/uploads/upload.service';
import { UserMapper } from './mappers/user.mapper';

@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UtilisateurController {
  constructor(
    private readonly utilisateurService: UtilisateurService,
    private readonly uploadService: UploadService,
    private readonly userMapper: UserMapper,
  ) {}


 @Get('profile')
async getProfile(@Req() req: any): Promise<ApiResponse> {

  const userId = req.user.userId;

  const user = await this.utilisateurService.findUserById(userId);

  return { data: user, message: 'Profil utilisateur', status: 200 };
}


 @Post('update_password')
async updatePassword(@Req() req: any,@Body() body:any): Promise<ApiResponse> {

  const userId = req.user.userId;

  const requester = await this.utilisateurService.updatePawword(req.user.userId,body.id,body.password);
   
    return { data: "Le mot de passe du compte utilisateur du nom de "+requester.username+" et de l'email "+requester.email+" a bien été modifier en "+body.pawword, message: 'Mise a jour du mot de passe reussi', status: 200 };
}

  @Post('push-token')
  async updatePushToken(@Req() req: any, @Body('token') token: string): Promise<ApiResponse> {
    const userId = req.user.userId;
    const user = await this.utilisateurService.updatePushToken(userId, token);
    return { data: user, message: 'Token push enregistré', status: 200 };
  }

  @Get()
  async findAll(@Req() req: any): Promise<ApiResponse> {
    const requester = await this.utilisateurService.findUserById(req.user.userId);
    if (requester?.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à accéder à cette ressource");
    }
    const users = await this.utilisateurService.findAll();
    return { data: users, message: 'Liste des utilisateurs', status: 200 };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse> {
    const user = await this.utilisateurService.findById(id);
    return { data: user, message: 'Utilisateur trouvé', status: 200 };
  }

  @Post()
  async create(@Body() body: CreateUserDto): Promise<ApiResponse> {
    const user = await this.utilisateurService.create(body);
    return { data: user, message: 'Utilisateur créé', status: 201 };
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UpdateUserDto & { data?: string },
    @Req() req: any,
  ): Promise<ApiResponse> {
    const requester = await this.utilisateurService.findUserById(Number(req.user.userId));
    const target = await this.utilisateurService.findById(id);
    if (!target) {
      throw new BadRequestException('Utilisateur introuvable');
    }
    if (requester?.role !== UserRole.ADMIN && target.id !== requester?.id) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à modifier ce profil");
    }

    let payload = this.parseUpdateData(body);
    if (requester?.role !== UserRole.ADMIN) {
      payload = {
        nom: payload.nom,
        prenom: payload.prenom,
        email: payload.email,
        telephone: payload.telephone,
        image: payload.image,
      };
    }
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.mimetype)) {
        throw new BadRequestException('Format d’image non pris en charge');
      }
      payload.image = this.uploadService.saveFile('profile', 'profiles', file);
    }

    const user = await this.utilisateurService.update(id, payload);
    return { data: this.userMapper.toResponse(user), message: 'Utilisateur mis à jour', status: 200 };
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse> {
    await this.utilisateurService.remove(id);
    return { data: null, message: 'Utilisateur supprimé', status: 200 };
  }

  private parseUpdateData(body: UpdateUserDto & { data?: string }): UpdateUserDto {
    if (typeof body.data !== 'string') {
      const { data: _data, ...payload } = body;
      return payload;
    }

    try {
      return JSON.parse(body.data) as UpdateUserDto;
    } catch {
      throw new BadRequestException('Les données du profil sont invalides');
    }
  }
}
