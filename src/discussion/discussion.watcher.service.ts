import { Injectable } from '@nestjs/common';

/**
 * Suivi en mémoire de "quels admins ont actuellement telle discussion ouverte"
 * (room Socket.IO rejointe). Sert à informer le client qu'un conseiller est
 * en train de regarder sa conversation.
 */
@Injectable()
export class DiscussionWatchersService {
  private watchers = new Map<string, Set<string>>(); // discussionId -> Set<socketId>

  addWatcher(discussionId: string, socketId: string): void {
    if (!this.watchers.has(discussionId)) {
      this.watchers.set(discussionId, new Set());
    }
    this.watchers.get(discussionId)!.add(socketId);
  }

  /** true si c'était le dernier admin présent sur cette discussion. */
  removeWatcher(discussionId: string, socketId: string): boolean {
    const sockets = this.watchers.get(discussionId);
    if (!sockets) return false;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.watchers.delete(discussionId);
      return true;
    }
    return false;
  }

  hasAdminWatching(discussionId: string): boolean {
    return this.watchers.has(discussionId);
  }

  /** À la déconnexion (sans leaveDiscussion explicite) : retire ce socket de
   * toutes les discussions, retourne celles où c'était le dernier admin. */
  removeSocketEverywhere(socketId: string): string[] {
    const nowEmpty: string[] = [];
    for (const [discussionId, sockets] of this.watchers.entries()) {
      if (sockets.has(socketId)) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
          this.watchers.delete(discussionId);
          nowEmpty.push(discussionId);
        }
      }
    }
    return nowEmpty;
  }
}