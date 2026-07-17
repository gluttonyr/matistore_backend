import { Injectable } from '@nestjs/common';
import { UtilisateurService } from 'src/utilisateur/utilisateur.service';
import { DiscussionService } from 'src/discussion/discussion.service';
import { MessageService } from 'src/message/message.service';
import { PresenceService } from 'src/presence/presence.service';
import { DiscussionType } from 'src/discussion/entities/discussion.entity';

@Injectable()
export class StatsService {
  constructor(
    private readonly utilisateurService: UtilisateurService,
    private readonly discussionService: DiscussionService,
    private readonly messageService: MessageService,
    private readonly presenceService: PresenceService,
  ) {}

  async getAdminDashboardStats() {
    const [usersTotal, usersNewToday, supportTotal, forumDiscussions] = await Promise.all([
      this.utilisateurService.count(),
      this.utilisateurService.countNewToday(),
      this.discussionService.countByType(DiscussionType.SUPPORT),
      this.discussionService.getDiscussionByType(DiscussionType.FORUM),
    ]);

    const forumDiscussion = forumDiscussions[0];
    const forumMessages = forumDiscussion
      ? await this.messageService.countByDiscussion(forumDiscussion.trackingId)
      : 0;

    return {
      usersTotal,
      usersNewToday,
      usersOnline: this.presenceService.getOnlineCount(),
      supportTotal,
      forumMessages,
    };
  }
}
