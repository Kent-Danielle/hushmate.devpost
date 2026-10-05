import { describe, expect, it } from 'vitest';
import { DEMO_HOUSE_NAME, DEMO_SIGN_OUT_NOTE, DEMO_STREAK_NOTE, iosSteps, joinNames, welcomeParts, welcomeText } from '../../src/lib/copy';

describe('joinNames', () => {
  it('handles none, one, two and three names', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['Maya'])).toBe('Maya');
    expect(joinNames(['Maya', 'Jordan'])).toBe('Maya and Jordan');
    expect(joinNames(['Maya', 'Jordan', 'Priya'])).toBe('Maya, Jordan and Priya');
  });

  it('trims names and drops blanks', () => {
    expect(joinNames([' Maya ', '', 'Jordan'])).toBe('Maya and Jordan');
  });
});

describe('welcome card copy', () => {
  const bots = ['Maya', 'Jordan', 'Priya'];

  it('welcomeText matches the spec wording exactly', () => {
    expect(welcomeText(bots)).toBe(
      "Welcome to DevPost Demo House. Maya, Jordan and Priya are simulated housemates. They'll nudge you every 5 to 10 minutes so you can feel how Hushmate works. When you're done, sign out, or the nudges will keep coming.",
    );
  });

  it('welcomeParts splits out the names and the bold "sign out"', () => {
    const p = welcomeParts(bots);
    expect(p.title).toBe('Welcome to DevPost Demo House');
    expect(p.names).toBe('Maya, Jordan and Priya');
    expect(p.emphasis).toBe('sign out');
    expect(`${p.title}. ${p.names}${p.intro} ${p.before}${p.emphasis}${p.after}`).toBe(welcomeText(bots));
  });

  it('uses the house name passed from GET /me, defaulting to the demo house', () => {
    expect(welcomeParts(bots, 'Other House').title).toBe('Welcome to Other House');
    expect(welcomeParts(bots).title).toBe(`Welcome to ${DEMO_HOUSE_NAME}`);
    expect(DEMO_HOUSE_NAME).toBe('DevPost Demo House');
  });
});

describe('fixed notes', () => {
  it('has the demo streak and sign-out notes', () => {
    expect(DEMO_STREAK_NOTE).toContain('fixed at 10 days');
    expect(DEMO_SIGN_OUT_NOTE).toBe('Signing out stops the demo nudges on this device.');
  });
});

describe('iosSteps', () => {
  it('returns four steps with the caller-supplied last step', () => {
    const steps = iosSteps('Then turn on notifications.');
    expect(steps).toHaveLength(4);
    expect(steps[0]).toBe('Tap Share in Safari.');
    expect(steps[3]).toBe('Then turn on notifications.');
  });
});
