// Side-effect import, first in a test file: env must be set before lib/env loads.
process.env.TELEGRAM_BOT_TOKEN ||= "123:TEST";
process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN ||= "line-test";
export {};
process.env.QUESTION_HOLD ||= "off";
