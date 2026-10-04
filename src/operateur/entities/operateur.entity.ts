import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';

@Entity('operateurs')
export class Operateur extends BaseEntity {
  @Column()
  nom!: string;

  /**
   * Gabarit complet du code USSD à composer, ex: "*155*2*2*{numero}*{numero}*{montant}#"
   * ou "*145*5*{montant}*1094127#". `{numero}` (numéro saisi par l'utilisateur)
   * et `{montant}` sont remplacés partout où ils apparaissent (0, 1 ou plusieurs
   * fois selon l'opérateur) — permet d'ajouter un opérateur avec un format
   * différent uniquement en base, sans toucher au code.
   */
  @Column({ name: 'format_ussd' })
  formatUssd!: string;

  @Column({ name: 'notification_name', type: 'varchar', length: 100, nullable: true })
  notification_name?: string;

  // Configuration des notifications reçues sur le téléphone du client.
  @Column({ name: 'notification_package_client', type: 'varchar', length: 150, nullable: true })
  notificationPackageClient?: string;

  @Column({ name: 'notification_pattern_client', type: 'text', nullable: true })
  notificationPatternClient?: string;

  // Configuration des notifications reçues sur le téléphone de l'administrateur.
  @Column({ name: 'notification_package_admin', type: 'varchar', length: 150, nullable: true })
  notificationPackageAdmin?: string;

  @Column({ name: 'notification_pattern_admin', type: 'text', nullable: true })
  notificationPatternAdmin?: string;

  @Column({ name: 'image_url', nullable: true })
  imageUrl?: string;

  @Column({ default: true })
  active!: boolean;
}
