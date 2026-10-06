import type { Reader, Usage } from '@/lib/reader/types';

export const usage: Usage = { inputTokens: 10, outputTokens: 5 };

// A reader whose every call fails loudly unless the test supplies it, so a
// test never passes by silently calling a step it did not expect.
export function fakeReader(over: Partial<Reader> = {}): Reader {
  const unused = (name: string) => async () => { throw new Error(`${name} was not expected in this test`); };
  return {
    readKey: unused('readKey'),
    readStudent: unused('readStudent'),
    readKlasik: unused('readKlasik'),
    draftRubric: unused('draftRubric'),
    gradeKlasik: unused('gradeKlasik'),
    ...over,
  };
}
