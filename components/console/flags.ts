// The report's flags are Turkish sentences ("2. soru net okunamadı",
// "İsim okunamadı"); the review screen needs to know which questions and
// whether the name they point at, to offer the right correction controls.
// Same convention lib/report/input.ts uses when it clears corrected flags.

export function flaggedQuestions(flags: string[]): number[] {
  const qs = flags.map((f) => /^(\d+)\. soru/.exec(f)?.[1]).filter(Boolean).map(Number);
  return [...new Set(qs)].sort((a, b) => a - b);
}

export const nameFlagged = (flags: string[]) => flags.some((f) => f.startsWith('İsim'));
