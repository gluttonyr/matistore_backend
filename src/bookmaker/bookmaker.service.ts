import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Bookmaker } from './entities/bookmaker.entity';
import { DEFAULT_BOOKMAKER } from './bookmaker.constants';

const DEFAULT_BOOKMAKERS: Array<Omit<Bookmaker, 'createdAt' | 'updatedAt'>> = [
  {
    code: '1XBET',
    nom: '1XBET',
    imageUrl: '1xbet.png',
    siteUrl: 'https://1xbet.com',
    appSchemes: ['xbet://open', 'xbet://openapp'],
    active: true,
    ordre: 1,
  },
  {
    // Inactive until its cash-desk keys are in the .env (MELBET_*): then set active = true in the database.
    code: 'MELBET',
    nom: 'MELBET',
    imageUrl: 'melbet.png',
    siteUrl: 'https://melbet.com',
    appSchemes: [],
    active: false,
    ordre: 2,
  },
];

// Logos shipped with the backend, copied into the uploads volume so the app loads them like operator images.
const BUNDLED_LOGOS_DIR = path.join(
  __dirname,
  '..',
  '..',
  'assets',
  'bookmakers',
);

@Injectable()
export class BookmakerService implements OnModuleInit {
  private readonly logger = new Logger(BookmakerService.name);

  constructor(
    @InjectRepository(Bookmaker)
    private readonly repository: Repository<Bookmaker>,
  ) {}

  async onModuleInit() {
    // Only missing rows are created: name, logo, links and `active` set in the database are never overwritten.
    for (const seed of DEFAULT_BOOKMAKERS) {
      if (!(await this.repository.findOneBy({ code: seed.code })))
        await this.repository.save(seed);
    }
    this.copyBundledLogos();
  }

  /** Every bookmaker, inactive ones included: the app shows them greyed out ("Bientôt disponible"). */
  findAll(): Promise<Bookmaker[]> {
    return this.repository.find({ order: { ordre: 'ASC', nom: 'ASC' } });
  }

  /** The bookmaker for a new transaction or an account check; apps without the choice send none → 1XBET. */
  async requireActive(code?: string | null): Promise<Bookmaker> {
    const wanted = (code?.trim() || DEFAULT_BOOKMAKER).toUpperCase();
    const bookmaker = await this.repository.findOneBy({ code: wanted });
    if (!bookmaker) throw new BadRequestException('Bookmaker inconnu');
    if (!bookmaker.active)
      throw new BadRequestException(
        `${bookmaker.nom} n’est pas encore disponible`,
      );
    return bookmaker;
  }

  private copyBundledLogos() {
    const root = process.env.UPLOAD_ROOT;
    if (!root || !fs.existsSync(BUNDLED_LOGOS_DIR)) return;
    try {
      const target = path.join(root, 'bookmakers');
      fs.mkdirSync(target, { recursive: true });
      for (const file of fs.readdirSync(BUNDLED_LOGOS_DIR)) {
        const destination = path.join(target, file);
        if (!fs.existsSync(destination))
          fs.copyFileSync(path.join(BUNDLED_LOGOS_DIR, file), destination);
      }
    } catch (error) {
      // A missing logo only shows an empty frame in the app: never block the start for it.
      this.logger.warn(
        `Logos bookmakers non copiés : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
