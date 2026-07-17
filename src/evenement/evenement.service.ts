import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { EvenementRepository } from './evenement.repository';
import { Evenement } from './entities/evenement.entity';
import { CategorieService } from 'src/categorie/categorie.service';
import { UtilisateurService } from 'src/utilisateur/utilisateur.service';
import { PushNotificationService } from 'src/notifications/push-notification.service';

@Injectable()
export class EvenementService {
  private readonly logger = new Logger(EvenementService.name);

  constructor(
    private readonly evenementRepository: EvenementRepository,
    private readonly categorieService: CategorieService,
    private readonly utilisateurService: UtilisateurService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  private async attachCategorie(
    evenement: Partial<Evenement> & { categorieTrackingId?: string },
  ): Promise<Partial<Evenement>> {
    const trackingId = evenement.categorie?.trackingId ?? evenement.categorieTrackingId;
    if (trackingId) {
      const categorie = await this.categorieService.findById(trackingId);
      if (categorie) {
        evenement.categorie = categorie;
      }
      delete (evenement as any).categorieTrackingId;
    }
    return evenement;
  }

  async create(evenement: Partial<Evenement> & { categorieTrackingId?: string }) {
    const entity = await this.attachCategorie(evenement);
    const saved = await this.evenementRepository.save(this.evenementRepository.create(entity));

    // Notifier les utilisateurs sans bloquer/faire échouer la création si l'envoi rate.
    this.notifyNewEvent(saved).catch((error) =>
      this.logger.error('Échec de la notification du nouvel événement', error),
    );

    return saved;
  }

  private async notifyNewEvent(evenement: Evenement): Promise<void> {
    const tokens = await this.utilisateurService.getAllPushTokens();
    if (tokens.length === 0) {
      return;
    }
    const body = evenement.lieu ? `${evenement.titre} — ${evenement.lieu}` : evenement.titre;
    await this.pushNotificationService.sendToTokens(
      tokens,
      'Nouvel événement 🎉',
      body,
      { type: 'event', trackingId: evenement.trackingId },
    );
  }

  findAll() {
    return this.evenementRepository.createQueryBuilder('evenement')
      .leftJoinAndSelect('evenement.user', 'user')
      .leftJoinAndSelect('evenement.categorie', 'categorie')
      .getMany();
  }

  findById(id: string) {
    return this.evenementRepository.createQueryBuilder('evenement')
      .leftJoinAndSelect('evenement.user', 'user')
      .leftJoinAndSelect('evenement.categorie', 'categorie')
      .where('evenement.trackingId = :id', { id })
      .getOne();
  }

  async update(id: string, payload: Partial<Evenement> & { categorieTrackingId?: string }) {
    const evenement = await this.findById(id);
    if (!evenement) {
      throw new BadRequestException('Événement introuvable');
    }
    await this.attachCategorie(payload);
    Object.assign(evenement, payload);
    return this.evenementRepository.save(evenement);
  }

  async remove(id: string) {
    const evenement = await this.findById(id);
    if (!evenement) {
      throw new BadRequestException('Événement introuvable');
    }
    return this.evenementRepository.remove(evenement);
  }
}
