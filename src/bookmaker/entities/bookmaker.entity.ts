import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A betting site whose accounts MatiStore credits and debits through its cash-desk API.
 * The app reads this list to build the "Bookmaker" step: name, logo, links and `active` all come
 * from here, so a bookmaker is switched on or off without an app update.
 */
@Entity('bookmakers')
export class Bookmaker {
  /** Stable code sent by the app and stored on each transaction, e.g. "1XBET", "MELBET". */
  @PrimaryColumn({ type: 'varchar', length: 20 }) code!: string;
  /** Name shown to users and used in messages ("Votre compte MELBET a été crédité"). */
  @Column({ type: 'varchar', length: 60 }) nom!: string;
  /** File in uploads/bookmakers, or a full https URL. */
  @Column({ name: 'image_url', type: 'varchar', length: 255, nullable: true })
  imageUrl?: string | null;
  /** Opened when the user taps "Ouvrir <nom>" and the bookmaker's app is not installed. */
  @Column({ name: 'site_url', type: 'varchar', length: 255, nullable: true })
  siteUrl?: string | null;
  /** Deep links tried first to open the bookmaker's app, e.g. ["xbet://open"]. */
  @Column({ name: 'app_schemes', type: 'simple-json', nullable: true })
  appSchemes?: string[] | null;
  @Column({ type: 'boolean', default: false }) active!: boolean;
  @Column({ type: 'int', default: 0 }) ordre!: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
