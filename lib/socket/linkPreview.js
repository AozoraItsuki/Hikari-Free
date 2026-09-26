export default function _linkPreview(ctx) {
  return {
    linkPreview: {
      value(...args) {
        return this.sendLinkPreview(...args);
      },
      enumerable: true,
    },
  };
}
