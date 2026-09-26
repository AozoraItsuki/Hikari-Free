export default function _insertAllGroup(ctx) {
  return {
    insertAllGroup: {
      async value() {
        const groups = (await this.groupFetchAllParticipating().catch(() => null)) || {};
        for (const group in groups) {
          this.chats[group] = {
            ...(this.chats[group] || {}),
            id: group,
            subject: groups[group].subject,
            isChats: true,
            metadata: groups[group],
          };
        }
        return this.chats;
      },
    },
  };
}
