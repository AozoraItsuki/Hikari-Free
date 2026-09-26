import {
  buildAIRichContent,
  buildAIRichWithButtons,
  buildAIRichWithMedia,
  parseRichText,
  codeBlock,
  bold,
  italic,
  strikethrough,
  mono,
  link,
} from '#lib/utils/helper';
export default function _tools(ctx) {
  return {
    tools: {
      get() {
        return {
          version: 'local',
          buildAIRichContent,
          buildAIRichWithButtons,
          buildAIRichWithMedia,
          toolkit: {
            parseRichText,
            codeBlock,
            bold,
            italic,
            strikethrough,
            mono,
            link,
          },
          parseRichText,
          codeBlock,
          bold,
          italic,
          strikethrough,
          mono,
          link,
          sendLinkPreview: (...args) => this.sendLinkPreview(...args),
          linkPreview: (...args) => this.sendLinkPreview(...args),
          bindToSocket: () => this,
        };
      },
      enumerable: true,
    },
  };
}
