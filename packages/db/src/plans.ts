export const PRO_PRICE_PAISE = 99900; // ₹999 one-time

export const PLAN_LIMITS = {
  FREE: {
    credits: 500,
    repos: 3,
    members: 10,
  },
  PRO: {
    credits: 5000,
    repos: 25,
    members: 50,
  },
} as const;
