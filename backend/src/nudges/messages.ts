/** The single source for the five nudge messages and the demo subtitle (PRD > Nudging). */
export const NUDGE_MESSAGES = [
  'Someone in the house is resting right now. Could you bring the volume down a little?',
  'Gentle heads-up: noise is carrying right now. A little quieter would go a long way.',
  "Psst, sound travels further than you'd think. Someone nearby could use some quiet.",
  "A quick reminder from your house: someone's winding down. Mind turning it down a notch?",
  'Your housemates would appreciate a calm space right now. Could you keep it down a bit?',
] as const;

export const DEMO_SUBTITLE = 'This is a demo nudge from a simulated housemate in DevPost Demo House.';

export function messageFor(index: number): string {
  return NUDGE_MESSAGES[index] ?? NUDGE_MESSAGES[0];
}

/** The push body: the message, plus a newline and the subtitle for demo nudges. */
export function pushBody(index: number, isDemo: boolean): string {
  return isDemo ? `${messageFor(index)}\n${DEMO_SUBTITLE}` : messageFor(index);
}
