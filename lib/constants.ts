// Placeholder app constants. Prices, limits and copy live here so they change in one place.

import { TECHNIQUE_ORDER, type Technique } from "./engine";

export const USER_NAME = "Irish";
export const DRILLS_PER_SESSION = 10;
export const MISTAKES_ALLOWED = 3;
export const TRAINER_TECHNIQUES: Technique[] = TECHNIQUE_ORDER;

// ---------- pricing (placeholders) ----------

export const CURRENCY = "USD";
export const FREE_TECHNIQUE_LIMIT = 3;
export const COACH_MESSAGES_PER_MONTH = 400;
export const REFUND_DAYS = 7;

export interface PlanFeature {
  label: string;
  included: boolean;
}

export interface Plan {
  id: "free" | "monthly" | "yearly" | "lifetime";
  name: string;
  price: number;
  /** Shown after the price, e.g. "per month". Empty for Free. */
  period: string;
  /** One short line under the price. */
  note: string;
  cta: string;
  primary: boolean;
  bestValue: boolean;
  features: PlanFeature[];
}

const PAID_EXTRAS = [
  `All ${TRAINER_TECHNIQUES.length} techniques with unlimited drills`,
  "Personalized daily plan",
  "Weak-spot report",
  `Coach messages (${COACH_MESSAGES_PER_MONTH} a month)`,
  "Speed run and Spot the mistake",
];

const FREE_FEATURES: PlanFeature[] = [
  { label: "Unlimited puzzles at all difficulties", included: true },
  { label: "Daily puzzle and streak", included: true },
  { label: "Review any puzzle", included: true },
  { label: `${FREE_TECHNIQUE_LIMIT} techniques to drill`, included: true },
  { label: "Random daily plan", included: true },
  ...PAID_EXTRAS.map((label) => ({ label, included: false })),
];

const PAID_FEATURES: PlanFeature[] = [
  { label: "Everything in Free", included: true },
  ...PAID_EXTRAS.map((label) => ({ label, included: true })),
];

const MONTHLY_PRICE = 6;
const YEARLY_PRICE_PER_MONTH = 3;
const LIFETIME_PRICE = 120;

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "",
    note: "For casual solvers.",
    cta: "Start free",
    primary: false,
    bestValue: false,
    features: FREE_FEATURES,
  },
  {
    id: "monthly",
    name: "Monthly",
    price: MONTHLY_PRICE,
    period: "per month",
    note: "Cancel anytime.",
    cta: "Go monthly",
    primary: true,
    bestValue: false,
    features: PAID_FEATURES,
  },
  {
    id: "yearly",
    name: "Yearly",
    price: YEARLY_PRICE_PER_MONTH,
    period: "per month",
    note: `Billed ${YEARLY_PRICE_PER_MONTH * 12} ${CURRENCY} a year.`,
    cta: "Go yearly",
    primary: true,
    bestValue: true,
    features: PAID_FEATURES,
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: LIFETIME_PRICE,
    period: "once",
    note: "One payment, no renewals.",
    cta: "Get lifetime",
    primary: true,
    bestValue: false,
    features: PAID_FEATURES,
  },
];

export const FAQ: { question: string; answer: string }[] = [
  {
    question: "What happens if I cancel?",
    answer: "You keep the free plan. Paid trainers, the coach and your weak-spot report switch off.",
  },
  {
    question: "Can I get a refund?",
    answer: `Yes, within ${REFUND_DAYS} days of buying, for any paid plan.`,
  },
  {
    question: "Do I need an account to play?",
    answer: "No. Playing, reviewing and training work in your browser without one.",
  },
];
