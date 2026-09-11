import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRepository } from './user.repository';
import { UserMapper } from './mappers/user.mapper';
import { DiscussionService } from 'src/discussion/discussion.service';
import { Discussion } from 'src/discussion/entities/discussion.entity';
import { UserRole } from './enums/user-role.enum';

@Injectable()
export class UtilisateurService implements OnModuleInit {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userMapper: UserMapper,
    private readonly discussionService: DiscussionService
  ) { }

  async onModuleInit() {
    await this.ensureAdminExists();
  }

  private async ensureAdminExists() {
    const admin = await this.userRepository.findOne({
      where: {
        role: UserRole.ADMIN,
      },
    });

    if (admin) {
      console.log('✅ Compte admin déjà existant');
      return;
    }

    const password = 'Admin@123456';

    const adminUser = this.userRepository.create({
      nom: 'Admin',
      prenom: 'System',
      username: 'admin',
      email: 'admin@matistore.com',
      password: await bcrypt.hash(password, 10),
      role: UserRole.ADMIN,
      active: true,
    });

    await this.userRepository.save(adminUser);

    console.log(`
  ====================================
  👑 Compte administrateur créé
  Email : admin@matistore.com
  Mot de passe : ${password}
  ====================================
  `);
  }



  async create(payload: CreateUserDto) {

    const existing = await this.userRepository.findOne({ where: { email: payload.email } });
    if (existing) {
      throw new BadRequestException('Email déjà utilisé par un autre utilisateur');
    }

    const entity = await this.userMapper.toEntity(payload);
    if (!entity.username) {
      const nom = payload.nom
        .trim()
        .toUpperCase();

      const prenom = payload.prenom
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');

      entity.username = `${nom} ${prenom}`;
    }




    const user = this.userRepository.create({
      ...entity,
      active: payload.active ?? true,
      password: payload.password
        ? await bcrypt.hash(payload.password, 10)
        : undefined,
    });

    const savedUser = await this.userRepository.save(user);

    await this.discussionService.createForUser(savedUser);

    return savedUser;

  }

  async getAdminPushTokens(): Promise<string[]> {
  // Adapte selon comment tu récupères déjà les users par rôle ailleurs
  const admins = await this.userRepository.find({
    where: { role: UserRole.ADMIN },
    relations: { pushDevices: true },
  });
  return admins
    .flatMap((u) => u.pushDevices ?? [])
    .filter((d) => d.active)
    .map((d) => d.token);
}

  async findAll() {
    return this.userRepository.find();
  }

  count() {
    return this.userRepository.count();
  }

  countNewToday() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return this.userRepository.countCreatedSince(startOfDay);
  }

  findByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.userRepository.findOne({ where: { trackingId: id } });
  }

  findUserById(id: number) {
    return this.userRepository.findOne({ where: { id } });
  }

  async updatePawword(adminId: number, userId: number, password: string) {
    const admin = await this.findUserById(adminId);
    if (!admin) {
      throw new BadRequestException('Compte Administrateur introuvable');
    }
    if (admin.role != UserRole.ADMIN) {
      throw new BadRequestException('Acces refusez, vous ne pouvez pas effectuer cette modification');
    }
    const user = await this.findUserById(adminId);
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }
    if (!user) {
      throw new BadRequestException('Mot de passe invalide');
    }


    user.password = await bcrypt.hash(password, 10);


    return this.userRepository.save(user);

  }

  async updatePushToken(id: number, expoPushToken: string) {
    const user = await this.findUserById(id);
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }
    user.expoPushToken = expoPushToken;
    return this.userRepository.save(user);
  }

  async getAllPushTokens(): Promise<string[]> {
    const users = await this.userRepository.find();
    return users.map((u) => u.expoPushToken).filter((t): t is string => !!t);
  }

  async update(id: string, payload: UpdateUserDto) {
    const user = await this.findById(id);
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }
    // if (payload.password) {
    //   payload.password = await bcrypt.hash(payload.password, 10);
    // }
    Object.assign(user, payload);
    return this.userRepository.save(user);
  }

  async remove(id: string) {
    const user = await this.findById(id);
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }
    return this.userRepository.remove(user);
  }
}
