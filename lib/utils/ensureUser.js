import { defaultUserConfig, repairUser } from '#src/default';

export default async function ensureUser(db, who, conn) {
  if (db.data.users[who]) {
    repairUser(db.data.users[who]);
    return db.data.users[who];
  }
  const user = structuredClone(defaultUserConfig);
  user.name = (await conn?.getName?.(who)?.catch?.(() => null)) || who.split('@')[0];
  db.data.users[who] = user;
  return user;
}
