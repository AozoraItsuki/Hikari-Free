import { db } from '#src/database';
export async function before(m) {
  if (this._antiCallInit) return !0;
  this._antiCallInit = true;
  this.ev.on('call', async (call) => {
    if (call[0].status == 'offer' && db.data.settings[this.user.jid]?.anticall)
      await this.rejectCall(call[0].id, call[0].from);
  });
  return !0;
}
