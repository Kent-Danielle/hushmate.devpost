// Fixed app copy (spec.md > Frontend: Shared lib). Pure functions, unit tested.
// Nudge messages and the demo subtitle are NOT here: the backend sends them.

/** "Maya", "Maya and Jordan", "Maya, Jordan and Priya". */
export function joinNames(names: readonly string[]): string {
  const list = names.map((n) => n.trim()).filter(Boolean);
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

export const DEMO_HOUSE_NAME = 'DevPost Demo House';

export interface WelcomeParts {
  title: string;
  /** The bolded bot names ("Maya, Jordan and Priya"). */
  names: string;
  /** What follows the names in the first paragraph. */
  intro: string;
  /** The second paragraph is `before` + bold `emphasis` + `after`. */
  before: string;
  emphasis: string;
  after: string;
}

/** The demo welcome card, split so the names and "sign out" can be set in bold. `houseName` and `botNames` come from GET /me `demo`. */
export function welcomeParts(botNames: readonly string[], houseName: string = DEMO_HOUSE_NAME): WelcomeParts {
  return {
    title: `Welcome to ${houseName}`,
    names: joinNames(botNames),
    intro: " are simulated housemates. They'll nudge you every 30 minutes to 2 hours so you can feel how Hushmate works.",
    before: "When you're done, ",
    emphasis: 'sign out',
    after: ', or the nudges will keep coming.',
  };
}

/** The whole welcome text as one string (same words as the card). */
export function welcomeText(botNames: readonly string[], houseName: string = DEMO_HOUSE_NAME): string {
  const p = welcomeParts(botNames, houseName);
  return `${p.title}. ${p.names}${p.intro} ${p.before}${p.emphasis}${p.after}`;
}

export const DEMO_STREAK_NOTE =
  'This is a demo house, so its Quiet Streak is fixed at 10 days. In your own house, it counts the days since anyone was nudged.';

export const DEMO_SIGN_OUT_NOTE = 'Signing out stops the demo nudges on this device.';

/** The Add to Home Screen steps (prd.md > Onboarding). `last` differs by where it is shown. */
export function iosSteps(last: string): string[] {
  return [
    'Tap Share in Safari.',
    'Choose Add to Home Screen and keep Open as Web App on.',
    'Open Hushmate from your Home Screen and sign in again.',
    last,
  ];
}
