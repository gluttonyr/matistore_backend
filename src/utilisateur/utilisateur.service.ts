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
import { In } from 'typeorm';
import { Transaction, TransactionStatus } from 'src/transaction/entities/transaction.entity';
import { PushDevice } from 'src/push-device/entities/push-device.entity';

@Injectable()
export class UtilisateurService implements OnModuleInit {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userMapper: UserMapper,
    private readonly discussionService: DiscussionService
  ) { }

  async onModuleInit() {
    await this.dropUsernameUniqueConstraint();
    await this.ensureAdminExists();
  }

  // Prod runs without TypeORM synchronize, so the old UNIQUE(username) stays in the database after the entity
  // dropped it. Removes it once (no-op afterwards); it only stops refusing equal usernames, no data is touched.
  private async dropUsernameUniqueConstraint() {
    try {
      await this.userRepository.query(`
        DO $$
        DECLARE c text;
        BEGIN
          FOR c IN
            SELECT con.conname FROM pg_constraint con
            JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
            WHERE con.conrelid = 'users'::regclass AND con.contype = 'u'
              AND array_length(con.conkey, 1) = 1 AND a.attname = 'username'
          LOOP
            EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c);
            RAISE NOTICE 'Dropped unique constraint % on users.username', c;
          END LOOP;
        END $$;
      `);
    } catch (error) {
      console.warn('⚠️ Could not drop the unique constraint on users.username:', error);
    }
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

    // One of the two names is enough (e.g. single-name Google accounts); the other stays empty.
    const rawNom = (payload.nom ?? '').trim();
    const rawPrenom = (payload.prenom ?? '').trim();
    if (!rawNom && !rawPrenom) {
      throw new BadRequestException('Indiquez au moins votre prénom ou votre nom');
    }

    const entity = await this.userMapper.toEntity({ ...payload, nom: rawNom, prenom: rawPrenom });
    if (!entity.username) {
      const nom = rawNom.toUpperCase();

      const prenom = rawPrenom
        .toLowerCase()
        .split(/\s+/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');

      entity.username = `${nom} ${prenom}`.trim();
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
    where: { role: UserRole.ADMIN, active: true },
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

  async findActiveUserIds(): Promise<number[]> {
    const users = await this.userRepository.find({
      select: { id: true },
      where: { role: UserRole.USER, active: true },
    });
    return users.map((user) => user.id);
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

  findByAppleId(appleId: string) {
    return this.userRepository.findByAppleId(appleId);
  }

  async linkAppleId(user: User, appleId: string) {
    user.appleId = appleId;
    return this.userRepository.save(user);
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

  // Account deletion requested by the user (App Store guideline 5.1.1(v)). Transactions must stay for the
  // financial records and reference the user row, so the row is anonymised instead of removed: every personal
  // field is erased, the email/Google/Apple links are freed and the account can no longer sign in.
  async deleteOwnAccount(userId: number) {
    const user = await this.findUserById(userId);
    if (!user || !user.active) {
      throw new BadRequestException('Compte introuvable');
    }
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Un compte administrateur ne peut pas être supprimé depuis l’application');
    }
    const openTransactions = await this.userRepository.manager.count(Transaction, {
      where: { user: { id: userId }, statut: In(OPEN_TRANSACTION_STATUSES) },
    });
    if (openTransactions > 0) {
      throw new BadRequestException('Une transaction est encore en cours sur votre compte. Attendez son traitement avant de supprimer le compte.');
    }

    await this.userRepository.manager.update(PushDevice, { userId }, { active: false });
    Object.assign(user, {
      nom: 'Compte',
      prenom: 'supprimé',
      username: 'Compte supprimé',
      email: `deleted-${user.trackingId}@deleted.matistore.tech`,
      telephone: null,
      image: null,
      password: null,
      googleId: null,
      appleId: null,
      provider: null,
      expoPushToken: null,
      active: false,
    });
    await this.userRepository.save(user);
  }
}

const OPEN_TRANSACTION_STATUSES = [
  TransactionStatus.EN_ATTENTE_AUTO,
  TransactionStatus.EN_VERIFICATION,
  TransactionStatus.EN_ATTENTE_PREUVE,
  TransactionStatus.EN_ATTENTE_ADMIN,
  TransactionStatus.EN_RECLAMATION,
];
