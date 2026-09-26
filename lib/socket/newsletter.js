const NEWSLETTER_METHODS = Object.freeze([
  'newsletterCreate',
  'newsletterUpdate',
  'newsletterUpdateName',
  'newsletterUpdateDescription',
  'newsletterUpdatePicture',
  'newsletterRemovePicture',
  'newsletterMetadata',
  'newsletterSubscribers',
  'newsletterSubscribed',
  'newsletterFollow',
  'newsletterUnfollow',
  'newsletterMute',
  'newsletterUnmute',
  'newsletterAdminCount',
  'newsletterChangeOwner',
  'newsletterDemote',
  'newsletterReactMessage',
  'newsletterFetchMessages',
  'newsletterDelete',
]);

export default function _newsletter(ctx) {
  const namespace = {
    prefix: 'newsletter',
  };
  for (const name of NEWSLETTER_METHODS) {
    const short = name.replace(/^newsletter/, '').toLowerCase();
    namespace[short] = {
      async value(...args) {
        if (typeof this[name] !== 'function') {
          throw new TypeError(`${name} is not supported by the active baileys build`);
        }
        return this[name](...args);
      },
      enumerable: true,
    };
  }
  return {
    newsletter: {
      value: namespace,
      enumerable: true,
    },
    newsletterSend: {
      async value(jid, content, opts = {}) {
        if (!jid) throw new TypeError('newsletterSend requires a target newsletter jid');
        const { quoted, ...options } = opts;
        return this.sendMessage(jid, content, { ...options, quoted });
      },
      enumerable: true,
    },
  };
}
