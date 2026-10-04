// colorIndex 0-4 -> --hm-mate-1..5; "you" is lavender (--hm-mate-you). Always tokens, never raw colours.

function mateNumber(colorIndex: number | null | undefined): number {
  const i = Number.isFinite(colorIndex) ? Math.trunc(colorIndex as number) : 0;
  return (((i % 5) + 5) % 5) + 1;
}

/** The pastel fill for a person (Night text sits on it). */
export function mateFill(colorIndex: number | null | undefined, you = false): string {
  return you ? 'var(--hm-mate-you)' : `var(--hm-mate-${mateNumber(colorIndex)})`;
}

/** The darker ink of the same pastel: the outline for someone who is away. */
export function mateInk(colorIndex: number | null | undefined, you = false): string {
  return you ? 'var(--hm-mate-you-ink)' : `var(--hm-mate-${mateNumber(colorIndex)}-ink)`;
}
