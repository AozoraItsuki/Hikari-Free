export default function _sendLocation(ctx) {
  return {
    sendLocation: {
      async value(jid, latitude, longitude, opts = {}) {
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new TypeError('invalid coordinates');
        }
        const { name, address, quoted, ...sendOptions } = opts;
        return this.sendMessage(
          jid,
          {
            location: {
              degreesLatitude: lat,
              degreesLongitude: lng,
              ...(name
                ? {
                    name: String(name),
                  }
                : {}),
              ...(address
                ? {
                    address: String(address),
                  }
                : {}),
            },
          },
          {
            quoted,
            ...sendOptions,
          }
        );
      },
      enumerable: true,
    },
  };
}
