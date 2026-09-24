import { describe, expect, it } from 'vitest';
import {
  browserStore, fileKey, keyTruth, labelGap, loadLabels, missingKeyAnswers, saveLabels, studentTruth,
  type KeyLabel, type StudentLabel,
} from '@/components/eval/labels';

const key = (answers: KeyLabel['answers'], questionCount = 3): KeyLabel =>
  ({ kind: 'key', questionCount, answers, done: false });
const student = (name: string, marks: StudentLabel['marks'], questionCount = 3): StudentLabel =>
  ({ kind: 'student', questionCount, name, marks, done: false });

// The screen stores what the admin entered; the metrics need the same
// "truth" shape scripts/eval-reader.ts reads from eval/data/*.json.
describe('labels → truth', () => {
  it('turns a key label into the key truth, blank as null, in question order', () => {
    expect(keyTruth(key({ 2: 'blank', 1: 'C', 3: 'A', 9: 'B' }))).toEqual({
      kind: 'key', questionCount: 3,
      answers: [{ q: 1, option: 'C' }, { q: 2, option: null }, { q: 3, option: 'A' }], // q9 is past the exam
    });
  });

  it('lists key questions that have no choice yet — blank must be chosen, not assumed', () => {
    expect(missingKeyAnswers(key({ 1: 'A', 3: 'blank' }, 4))).toEqual([2, 4]);
  });

  it('turns a student label into the student truth; an untouched question is blank', () => {
    expect(studentTruth(student('  Işıl Öztürk ', { 1: ['C', 'A'], 3: [] }))).toEqual({
      kind: 'student', questionCount: 3, studentName: 'Işıl Öztürk',
      answers: [{ q: 1, marked: ['A', 'C'] }, { q: 2, marked: [] }, { q: 3, marked: [] }],
    });
  });

  it('says what still keeps a label from being confirmed', () => {
    expect(labelGap(key({ 1: 'A', 3: 'blank' }, 4))).toBe('Seçilmeyen sorular: 2, 4');
    expect(labelGap(key({ 1: 'A', 2: 'B', 3: 'blank' }))).toBeNull();
    expect(labelGap(student('   ', {}))).toBe('Öğrencinin kâğıda yazdığı adı girin.');
    expect(labelGap(student('Ada', {}))).toBeNull(); // an empty sheet is a valid label
  });

  it('keys a photo by name and size, so re-selecting the same file finds its labels', () => {
    expect(fileKey({ name: 'kagit-01.jpg', size: 2048 })).toBe('kagit-01.jpg:2048');
  });
});

// Labels are an hour of manual work: they must survive a reload, and a
// blocked or broken storage must never take the screen down with it.
describe('label storage', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('round-trips labels', () => {
    const store = memory();
    const labels = { 'a.jpg:1': key({ 1: 'A' }, 1) };
    saveLabels(store, labels);
    expect(loadLabels(store)).toEqual(labels);
  });

  it('starts empty when storage is blocked, missing or holds something else', () => {
    const blocked = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => {} };
    expect(loadLabels(blocked)).toEqual({});
    expect(loadLabels(undefined)).toEqual({});
    const junk = memory();
    junk.setItem('sinavoku:olcum:v1', '[1,2]');
    expect(loadLabels(junk)).toEqual({});
    junk.setItem('sinavoku:olcum:v1', '{nope');
    expect(loadLabels(junk)).toEqual({});
  });

  it('keeps working when storage refuses to save', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(() => saveLabels(full, {})).not.toThrow();
  });

  it('has no store where there is no window (server render) instead of throwing', () => {
    expect(browserStore()).toBeUndefined();
  });
});
