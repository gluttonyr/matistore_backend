import { Injectable } from '@nestjs/common';

/**
 * Suivi de présence en mémoire : un utilisateur est "en ligne" tant qu'au
 * moins une de ses connexions socket est active (plusieurs onglets/appareils
 * possibles par utilisateur, d'où le Set de socketId).
 *
 * ⚠️ En mémoire du processus : fonctionne parfaitement tant qu'un seul
 * serveur backend tourne (cas actuel). Si un jour l'app est déployée sur
 * plusieurs instances derrière un load balancer, il faudra migrer ce
 * registre vers un store partagé (ex: Redis).
 */
@Injectable()
export class PresenceService {
  private onlineUsers = new Map<number, Set<string>>();

  addConnection(userId: number, socketId: string): void {
    if (!this.onlineUsers.has(userId)) {
      this.onlineUsers.set(userId, new Set());
    }
    this.onlineUsers.get(userId)!.add(socketId);
  }

  removeConnection(userId: number, socketId: string): void {
    const sockets = this.onlineUsers.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.onlineUsers.delete(userId);
    }
  }

  getOnlineCount(): number {
    return this.onlineUsers.size;
  }

  isOnline(userId: number): boolean {
    return this.onlineUsers.has(userId);
  }
}
