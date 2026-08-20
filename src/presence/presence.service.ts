import { Injectable } from '@nestjs/common';

@Injectable()
export class PresenceService {
  private onlineUsers = new Map<number, Set<string>>();
  private lastSeen = new Map<number, Date>();

  addConnection(userId: number, socketId: string): void {
    if (!this.onlineUsers.has(userId)) {
      this.onlineUsers.set(userId, new Set());
    }
    this.onlineUsers.get(userId)!.add(socketId);
  }

  /**
   * Retourne true si c'était la dernière connexion active de cet utilisateur
   * (donc il vient de passer hors ligne), false sinon (il a encore d'autres
   * sockets ouverts, ex: un autre onglet).
   */
  removeConnection(userId: number, socketId: string): boolean {
    const sockets = this.onlineUsers.get(userId);
    if (!sockets) return false;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.onlineUsers.delete(userId);
      this.lastSeen.set(userId, new Date());
      return true;
    }
    return false;
  }

  getOnlineCount(): number {
    return this.onlineUsers.size;
  }

  isOnline(userId: number): boolean {
    return this.onlineUsers.has(userId);
  }

  getOnlineUserIds(): number[] {
    return Array.from(this.onlineUsers.keys());
  }

  getLastSeen(userId: number): Date | undefined {
    return this.lastSeen.get(userId);
  }
}