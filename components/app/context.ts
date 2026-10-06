'use client';

import { createContext, useContext } from 'react';
import type { Api, Me } from '@/components/console/api';

// What every screen of the teacher's panel shares: the API, the signed-in
// teacher, and a way to refresh them after something changes the balance.
export type Teacher = { api: Api; me: Me; refreshMe: () => Promise<void>; signOut: () => Promise<void> };

export const TeacherContext = createContext<Teacher | null>(null);

export function useTeacher(): Teacher {
  const t = useContext(TeacherContext);
  if (!t) throw new Error('useTeacher outside the panel');
  return t;
}
