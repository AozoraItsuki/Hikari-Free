class InteractiveValidationError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = 'InteractiveValidationError';
    this.context = meta.context;
    this.errors = meta.errors || [];
    this.warnings = meta.warnings || [];
    this.example = meta.example;
    Error.captureStackTrace(this, this.constructor);
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      errors: this.errors,
      warnings: this.warnings,
      example: this.example,
    };
  }
  formatDetailed() {
    const lines = [`[${this.name}] ${this.message}${this.context ? ` (${this.context})` : ''}`];
    if (this.errors.length > 0) {
      lines.push('Errors:', ...this.errors.map((e) => `  - ${e}`));
    }
    if (this.warnings.length > 0) {
      lines.push('Warnings:', ...this.warnings.map((w) => `  - ${w}`));
    }
    if (this.example) {
      lines.push('Example payload:', JSON.stringify(this.example, null, 2));
    }
    return lines.join('\n');
  }
}
const SEND_BUTTONS_ALLOWED_COMPLEX = new Set(['cta_url', 'cta_copy', 'cta_call']);
const INTERACTIVE_ALLOWED_NAMES = new Set([
  'quick_reply',
  'cta_url',
  'cta_copy',
  'cta_call',
  'cta_catalog',
  'cta_reminder',
  'cta_cancel_reminder',
  'message_reminder',
  'cancel_message_reminder',
  'address_message',
  'send_location',
  'open_webview',
  'mpm',
  'flow',
  'wa_payment_transaction_details',
  'automated_greeting_message_view_catalog',
  'galaxy_message',
  'single_select',
  'payment_key_info',
  'review_and_pay',
  'payment_info',
  'message',
]);
const NATIVE_FLOW_SPECIALS = [
  'mpm',
  'flow',
  'cta_catalog',
  'send_location',
  'call_permission_request',
  'wa_payment_transaction_details',
  'automated_greeting_message_view_catalog',
  'cta_reminder',
  'cta_cancel_reminder',
  'message_reminder',
  'cancel_message_reminder',
];
const REQUIRED_FIELDS_MAP = {
  cta_url: ['display_text', 'url'],
  cta_copy: ['display_text', 'copy_code'],
  cta_call: ['display_text', 'phone_number'],
  cta_catalog: ['business_phone_number'],
  cta_reminder: ['display_text'],
  cta_cancel_reminder: ['display_text'],
  message_reminder: ['display_text'],
  cancel_message_reminder: ['display_text'],
  address_message: ['display_text'],
  send_location: [],
  open_webview: ['title', 'link'],
  mpm: ['display_text', 'id'],
  flow: ['display_text', 'id'],
  wa_payment_transaction_details: ['transaction_id'],
  automated_greeting_message_view_catalog: ['business_phone_number', 'catalog_product_id'],
  galaxy_message: ['flow_token', 'flow_id'],
  single_select: ['title', 'sections'],
  quick_reply: ['display_text', 'id'],
  payment_key_info: [],
  review_and_pay: [],
  payment_info: [],
  message: [],
};
const SOFT_BUTTON_CAP = 25;
const BUTTON_TYPE_NATIVE_NAME = {
  reply: 'quick_reply',
  url: 'cta_url',
  copy: 'cta_copy',
  call: 'cta_call',
  reminder: 'cta_reminder',
  'cancel-reminder': 'cta_cancel_reminder',
  'message-reminder': 'message_reminder',
  'cancel-message-reminder': 'cancel_message_reminder',
  location: 'send_location',
  address: 'address_message',
  mpm: 'mpm',
  flow: 'flow',
  catalog: 'cta_catalog',
  webview: 'open_webview',
  'single-select': 'single_select',
  'payment-key-info': 'payment_key_info',
  galaxy: 'galaxy_message',
  'payment-transaction-details': 'wa_payment_transaction_details',
  'greeting-catalog': 'automated_greeting_message_view_catalog',
  quick_reply: 'quick_reply',
  cta_url: 'cta_url',
  cta_copy: 'cta_copy',
  cta_call: 'cta_call',
  cta_reminder: 'cta_reminder',
  cta_cancel_reminder: 'cta_cancel_reminder',
  message_reminder: 'message_reminder',
  cancel_message_reminder: 'cancel_message_reminder',
  send_location: 'send_location',
  address_message: 'address_message',
  single_select: 'single_select',
  cta_catalog: 'cta_catalog',
  open_webview: 'open_webview',
  payment_key_info: 'payment_key_info',
  galaxy_message: 'galaxy_message',
  wa_payment_transaction_details: 'wa_payment_transaction_details',
  automated_greeting_message_view_catalog: 'automated_greeting_message_view_catalog',
};
function buildButtonParamsObject(type, btn) {
  if (btn.params && typeof btn.params === 'object' && !Array.isArray(btn.params)) {
    return {
      ...btn.params,
    };
  }
  const normalizedType =
    {
      cta_url: 'url',
      cta_copy: 'copy',
      cta_call: 'call',
      cta_reminder: 'reminder',
      cta_cancel_reminder: 'cancel-reminder',
      message_reminder: 'message-reminder',
      cancel_message_reminder: 'cancel-message-reminder',
      send_location: 'location',
      address_message: 'address',
      cta_catalog: 'catalog',
      open_webview: 'webview',
      single_select: 'single-select',
      payment_key_info: 'payment-key-info',
      galaxy_message: 'galaxy',
      wa_payment_transaction_details: 'payment-transaction-details',
      automated_greeting_message_view_catalog: 'greeting-catalog',
    }[type] || type;
  switch (normalizedType) {
    case 'reply':
      return {
        display_text: btn.text,
        id: btn.id,
      };
    case 'url':
      return {
        display_text: btn.text,
        url: btn.url,
        ...(btn.webview !== undefined
          ? {
              webview_presentation: !!btn.webview,
            }
          : {}),
        ...(btn.webviewPresentation !== undefined
          ? {
              webview_presentation: !!btn.webviewPresentation,
            }
          : {}),
        ...(btn.webviewInteraction !== undefined
          ? {
              webview_interaction: !!btn.webviewInteraction,
            }
          : {}),
        ...(btn.merchant_url
          ? {
              merchant_url: btn.merchant_url,
            }
          : {}),
      };
    case 'copy':
      return {
        display_text: btn.text,
        copy_code: btn.code,
      };
    case 'call':
      return {
        display_text: btn.text,
        phone_number: btn.phone,
      };
    case 'reminder':
      return {
        display_text: btn.text,
        ...(btn.id
          ? {
              id: btn.id,
            }
          : {}),
      };
    case 'cancel-reminder':
      return {
        display_text: btn.text,
        ...(btn.id
          ? {
              id: btn.id,
            }
          : {}),
      };
    case 'message-reminder':
      return {
        display_text: btn.text,
        ...(btn.id
          ? {
              id: btn.id,
            }
          : {}),
      };
    case 'cancel-message-reminder':
      return {
        display_text: btn.text,
        ...(btn.id
          ? {
              id: btn.id,
            }
          : {}),
      };
    case 'location':
      return {
        ...(btn.text
          ? {
              display_text: btn.text,
            }
          : {}),
      };
    case 'address':
      return {
        display_text: btn.text,
        ...(btn.id
          ? {
              id: btn.id,
            }
          : {}),
      };
    case 'mpm':
      return {
        display_text: btn.text,
        id: btn.id,
      };
    case 'flow':
      return {
        display_text: btn.text,
        id: btn.id,
        ...(btn.flowId
          ? {
              flow_id: btn.flowId,
            }
          : {}),
        ...(btn.flowToken
          ? {
              flow_token: btn.flowToken,
            }
          : {}),
        ...(btn.flowAction
          ? {
              flow_action: btn.flowAction,
            }
          : {}),
      };
    case 'catalog':
      return {
        business_phone_number: btn.businessPhoneNumber || btn.phone || btn.id,
        ...(btn.catalogId
          ? {
              catalog_id: btn.catalogId,
            }
          : {}),
      };
    case 'webview':
      return {
        title: btn.title || btn.text,
        link:
          typeof btn.link === 'object'
            ? btn.link
            : {
                url: btn.url || btn.link || '',
              },
        ...(btn.orientation
          ? {
              orientation: btn.orientation,
            }
          : {}),
      };
    case 'single-select':
      return {
        title: btn.title || btn.text || '',
        sections: Array.isArray(btn.sections) ? btn.sections : [],
      };
    case 'payment-key-info':
      return {
        ...(btn.params || {}),
        ...(btn.key
          ? {
              key: btn.key,
            }
          : {}),
      };
    case 'galaxy':
      return {
        flow_token: btn.flowToken || btn.token,
        flow_id: btn.flowId || btn.id,
        ...(btn.params || {}),
      };
    case 'payment-transaction-details':
      return {
        transaction_id: btn.transactionId || btn.id,
      };
    case 'greeting-catalog':
      return {
        business_phone_number: btn.businessPhoneNumber || btn.phone || btn.id,
        catalog_product_id: btn.catalogProductId || btn.productId,
      };
    default:
      return {
        display_text: btn.text || '',
        id: btn.id || '',
      };
  }
}
function buildNativeFlowButton(btn) {
  if (!btn || typeof btn !== 'object') return null;
  if (isNativeFlowButton(btn)) {
    return {
      name: btn.name,
      buttonParamsJson:
        typeof btn.buttonParamsJson === 'string'
          ? btn.buttonParamsJson
          : JSON.stringify(btn.buttonParamsJson || {}),
    };
  }
  if (isOldBaileysButton(btn)) {
    return {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: btn.buttonText.displayText,
        id: btn.buttonId,
      }),
    };
  }
  const type = btn.type || btn.kind || 'reply';
  const nativeName = BUTTON_TYPE_NATIVE_NAME[type];
  if (nativeName) {
    const params =
      nativeName === type && btn.params && typeof btn.params === 'object'
        ? btn.params
        : buildButtonParamsObject(type, btn);
    return {
      name: nativeName,
      buttonParamsJson: JSON.stringify(params),
    };
  }
  if (isLegacyButton(btn)) {
    return {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: btn.text || '',
        id: btn.id || '',
      }),
    };
  }
  return null;
}
function buildNativeFlowButtons(list) {
  return (Array.isArray(list) ? list : []).map(buildNativeFlowButton).filter(Boolean);
}
function safeParseJsonObject(str) {
  try {
    const parsed = JSON.parse(str);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function buildMessageParamsJson(opts = {}) {
  const params = {};
  if (opts.limitedTimeOffer) {
    params.limited_time_offer = {
      text: opts.limitedTimeOffer.text,
      url: opts.limitedTimeOffer.url,
      copy_code: opts.limitedTimeOffer.copyCode,
      expiration_time: opts.limitedTimeOffer.expirationTime,
    };
  }
  if (opts.bottomSheet) {
    params.bottom_sheet = {
      in_thread_buttons_limit: opts.bottomSheet.inThreadButtonsLimit,
      divider_indices: opts.bottomSheet.dividerIndices,
      list_title: opts.bottomSheet.listTitle,
      button_title: opts.bottomSheet.buttonTitle,
    };
  }
  if (opts.tapTargetConfiguration) {
    params.tap_target_configuration = {
      title: opts.tapTargetConfiguration.title,
      description: opts.tapTargetConfiguration.description,
      canonical_url: opts.tapTargetConfiguration.canonicalUrl,
      domain: opts.tapTargetConfiguration.domain,
      buttonIndex: opts.tapTargetConfiguration.buttonIndex,
    };
  }
  const base =
    typeof opts.base === 'string'
      ? safeParseJsonObject(opts.base)
      : opts.base && typeof opts.base === 'object'
        ? opts.base
        : {};
  return {
    ...base,
    ...params,
  };
}
function validateInteractiveMessageContent(content) {
  const errors = [];
  const warnings = [];
  if (!content || typeof content !== 'object') {
    return {
      errors: ['content must be an object'],
      warnings,
      valid: false,
    };
  }
  const interactive = content.interactiveMessage;
  if (!interactive) {
    return {
      errors,
      warnings,
      valid: true,
    };
  }
  const nativeFlow = interactive.nativeFlowMessage;
  if (!nativeFlow) {
    return {
      errors: ['interactiveMessage.nativeFlowMessage missing'],
      warnings,
      valid: false,
    };
  }
  if (!Array.isArray(nativeFlow.buttons)) {
    return {
      errors: ['nativeFlowMessage.buttons must be an array'],
      warnings,
      valid: false,
    };
  }
  if (nativeFlow.buttons.length === 0) {
    warnings.push('nativeFlowMessage.buttons is empty');
  }
  nativeFlow.buttons.forEach((btn, i) => {
    if (!btn || typeof btn !== 'object') {
      errors.push(`buttons[${i}] is not an object`);
      return;
    }
    if (!btn.buttonParamsJson) {
      warnings.push(`buttons[${i}] missing buttonParamsJson (may fail to render)`);
    } else if (typeof btn.buttonParamsJson !== 'string') {
      errors.push(`buttons[${i}] buttonParamsJson must be string`);
    } else {
      try {
        JSON.parse(btn.buttonParamsJson);
      } catch (e) {
        warnings.push(`buttons[${i}] buttonParamsJson invalid JSON (${e.message})`);
      }
    }
    if (!btn.name) {
      warnings.push(`buttons[${i}] missing name; defaulting to quick_reply`);
      btn.name = 'quick_reply';
    }
  });
  return {
    errors,
    warnings,
    valid: errors.length === 0,
  };
}
function validateSendInteractiveMessagePayload(data) {
  const errors = [];
  const warnings = [];
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['payload must be an object'],
      warnings,
    };
  }
  if (!data.text || typeof data.text !== 'string') {
    errors.push('text is mandatory and must be a string');
  }
  if (!Array.isArray(data.interactiveButtons) || data.interactiveButtons.length === 0) {
    errors.push('interactiveButtons is mandatory and must be a non-empty array');
  } else {
    data.interactiveButtons.forEach((rawBtn, i) => {
      const btn = buildNativeFlowButton(rawBtn);
      if (!btn) {
        errors.push(`interactiveButtons[${i}] must be an object`);
        return;
      }
      if (!INTERACTIVE_ALLOWED_NAMES.has(btn.name)) {
        errors.push(`interactiveButtons[${i}] name '${btn.name}' not allowed`);
        return;
      }
      parseButtonParams(btn.name, btn.buttonParamsJson, errors, warnings, i);
    });
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
function isLegacyButton(btn) {
  return Boolean(btn?.id || btn?.text);
}
function isOldBaileysButton(btn) {
  return Boolean(btn?.buttonId && btn?.buttonText?.displayText);
}
function isNativeFlowButton(btn) {
  return Boolean(btn?.name && btn?.buttonParamsJson);
}
function createExternalAdReply(options) {
  return {
    title: options.title || '',
    body: options.body || '',
    thumbnailUrl: options.thumbnailUrl,
    thumbnail: options.thumbnail,
    sourceUrl: options.sourceUrl,
    mediaType: options.mediaType || 1,
    renderLargerThumbnail: options.renderLargerThumbnail || false,
    showAdAttribution: options.showAdAttribution || false,
  };
}
function safeJSONParse(str, errors, _warnings, index, name) {
  try {
    return JSON.parse(str);
  } catch (e) {
    const error = e;
    errors.push(`button[${index}] (${name}) invalid JSON: ${error.message}`);
    return null;
  }
}
function convertToInteractiveMessage(content) {
  if (!content || typeof content !== 'object') return content;
  if (content.interactiveMessage) return content;
  if (!content.nativeFlow && !Array.isArray(content.interactiveButtons)) {
    return content;
  }
  const interactiveMessage = {
    nativeFlowMessage: {
      buttons: buildNativeFlowButtons(content.interactiveButtons),
    },
  };
  const messageParamsPayload = buildMessageParamsJson({
    base: content.messageParamsJson || content.messageParams,
    limitedTimeOffer: content.limitedTimeOffer,
    bottomSheet: content.bottomSheet,
    tapTargetConfiguration: content.tapTargetConfiguration,
  });
  if (Object.keys(messageParamsPayload).length > 0) {
    interactiveMessage.nativeFlowMessage.messageParamsJson = JSON.stringify(messageParamsPayload);
  }
  if (content.contextInfo) interactiveMessage.contextInfo = content.contextInfo;
  if (content.header) {
    interactiveMessage.header = content.header;
  } else if (content.title || content.subtitle) {
    interactiveMessage.header = {
      title: content.title || content.subtitle || '',
    };
  }
  if (content.text !== undefined)
    interactiveMessage.body = {
      text: content.text,
    };
  if (content.footer)
    interactiveMessage.footer = {
      text: content.footer,
    };
  const {
    interactiveButtons,
    nativeFlow,
    viewOnce,
    title,
    subtitle,
    text,
    footer,
    messageParams,
    messageParamsJson,
    limitedTimeOffer,
    bottomSheet,
    tapTargetConfiguration,
    header,
    contextInfo,
    ...rest
  } = content;
  return {
    ...rest,
    viewOnce: viewOnce !== false,
    interactiveMessage,
  };
}
function buildInteractiveButtonsContent(options = {}, buttons = []) {
  const content = {
    viewOnce: true,
    interactiveMessage: {
      body: {
        text: options.text || '',
      },
      footer: options.footer
        ? {
            text: options.footer,
          }
        : undefined,
      header: options.header,
      nativeFlowMessage: {
        buttons: buildNativeFlowButtons(buttons),
        messageParamsJson: options.messageParamsJson || '',
      },
      contextInfo: {
        ...(options.contextInfo || {}),
        mentionedJid: options.mentions || options.contextInfo?.mentionedJid || [],
      },
    },
  };
  return content;
}
function buildLegacyButtonsContent(options = {}, buttons = []) {
  const nativeButtons = buttons.map((button) => {
    const type = button.type || 'reply';
    if (type === 'url') {
      return {
        urlButton: {
          displayText: button.text,
          url: button.url,
        },
      };
    }
    if (type === 'call') {
      return {
        callButton: {
          displayText: button.text,
          phoneNumber: button.phone,
        },
      };
    }
    if (type === 'copy') {
      return {
        copyButton: {
          displayText: button.text,
          copyCode: button.code,
        },
      };
    }
    return {
      quickReplyButton: {
        displayText: button.text,
        id: button.id,
      },
    };
  });
  return {
    buttonsMessage: {
      ...options,
      buttons: nativeButtons,
    },
  };
}
function parseButtonParams(name, buttonParamsJson, errors, warnings, index) {
  const parsed = safeJSONParse(buttonParamsJson, errors, warnings, index, name);
  if (!parsed) return null;
  const required = REQUIRED_FIELDS_MAP[name] || [];
  required.forEach((field) => {
    if (!(field in parsed)) {
      errors.push(`button[${index}] (${name}) missing required field '${field}'`);
    }
  });
  if (name === 'open_webview' && parsed.link) {
    if (typeof parsed.link !== 'object' || !parsed.link.url) {
      errors.push(`button[${index}] (open_webview) link.url required`);
    }
  }
  if (name === 'single_select') {
    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      errors.push(`button[${index}] (single_select) sections must be non-empty array`);
    }
  }
  return parsed;
}
function getButtonType(message) {
  if (message.listMessage) return 'list';
  if (message.buttonsMessage) return 'buttons';
  if (message.interactiveMessage?.nativeFlowMessage) return 'native_flow';
  return null;
}
function getButtonArgs(message) {
  const nativeFlow = message.interactiveMessage?.nativeFlowMessage;
  const firstButtonName = nativeFlow?.buttons?.[0]?.name;
  if (nativeFlow && (firstButtonName === 'review_and_pay' || firstButtonName === 'payment_info')) {
    return {
      tag: 'biz',
      attrs: {
        native_flow_name: firstButtonName === 'review_and_pay' ? 'order_details' : firstButtonName,
      },
    };
  }
  if (nativeFlow && NATIVE_FLOW_SPECIALS.includes(firstButtonName)) {
    return {
      tag: 'biz',
      attrs: {},
      content: [
        {
          tag: 'interactive',
          attrs: {
            type: 'native_flow',
            v: '1',
          },
          content: [
            {
              tag: 'native_flow',
              attrs: {
                v: '2',
                name: firstButtonName,
              },
            },
          ],
        },
      ],
    };
  }
  if (nativeFlow || message.buttonsMessage) {
    return {
      tag: 'biz',
      attrs: {},
      content: [
        {
          tag: 'interactive',
          attrs: {
            type: 'native_flow',
            v: '1',
          },
          content: [
            {
              tag: 'native_flow',
              attrs: {
                v: '9',
                name: 'mixed',
              },
            },
          ],
        },
      ],
    };
  }
  if (message.listMessage) {
    return {
      tag: 'biz',
      attrs: {},
      content: [
        {
          tag: 'list',
          attrs: {
            v: '2',
            type: 'product_list',
          },
        },
      ],
    };
  }
  return {
    tag: 'biz',
    attrs: {},
  };
}
const helper = {
  InteractiveValidationError,
  SEND_BUTTONS_ALLOWED_COMPLEX,
  INTERACTIVE_ALLOWED_NAMES,
  NATIVE_FLOW_SPECIALS,
  REQUIRED_FIELDS_MAP,
  SOFT_BUTTON_CAP,
  BUTTON_TYPE_NATIVE_NAME,
  validateInteractiveMessageContent,
  validateSendInteractiveMessagePayload,
  isLegacyButton,
  isOldBaileysButton,
  isNativeFlowButton,
  createExternalAdReply,
  safeJSONParse,
  convertToInteractiveMessage,
  parseButtonParams,
  buildButtonParamsObject,
  buildNativeFlowButton,
  buildNativeFlowButtons,
  buildMessageParamsJson,
  buildInteractiveButtonsContent,
  buildLegacyButtonsContent,
  getButtonType,
  getButtonArgs,
};
export default helper;
