export type CustomServicePrices = {
  one_on_one: { single: number; weekly: number; monthly: number };
  homework_help: { live_discussion: number; chat_support: number };
};

export const DEFAULT_CUSTOM_SERVICE_PRICES: CustomServicePrices = {
  one_on_one: {
    single: 600,
    weekly: 2000,
    monthly: 4800,
  },
  homework_help: {
    live_discussion: 500,
    chat_support: 200,
  },
};
