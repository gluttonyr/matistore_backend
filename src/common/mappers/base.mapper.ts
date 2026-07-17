import { v4 as uuidv4 } from 'uuid';

export abstract class BaseMapper<E, D> {
  abstract toEntity(dto: Partial<D>): Promise<Partial<E>>;
  abstract toResponse(entity: E): D;
  abstract toResponseList(entities: E[]): Promise<D[]>;

  /**
   * Génère un nouveau trackingId pour chaque entité
   * Utiliser dans les mappers enfants lors de la création/mise à jour
   */
  protected generateTrackingId(): string {
    return uuidv4();
  }

  /**
   * Exclut l'id interne, garde uniquement le trackingId
   */
  protected excludeInternalId(entity: any): void {
    delete entity.id;
  }
}
