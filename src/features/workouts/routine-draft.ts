import { useSyncExternalStore } from 'react';

import type { Exercise } from './types';

/** Borrador de la rutina en edición mientras se navega al selector de ejercicios. */
export interface DraftExercise {
  exercise: Exercise;
  sets: string;
  reps: string;
  rest: string;
}

export interface RoutineDraft {
  forId: string;
  name: string;
  notes: string;
  weekdays: number[];
  exercises: DraftExercise[];
}

export const emptyRoutineDraft = (forId = ''): RoutineDraft => ({ forId, name: '', notes: '', weekdays: [], exercises: [] });

let draft = emptyRoutineDraft();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const routineDraft = {
  get: () => draft,
  reset(v: RoutineDraft) {
    draft = v;
    emit();
  },
  set(patch: Partial<RoutineDraft>) {
    draft = { ...draft, ...patch };
    emit();
  },
  addExercise(exercise: Exercise) {
    if (draft.exercises.some((e) => e.exercise.id === exercise.id)) return;
    draft = { ...draft, exercises: [...draft.exercises, { exercise, sets: '3', reps: '10', rest: '90' }] };
    emit();
  },
  updateExercise(i: number, patch: Partial<DraftExercise>) {
    draft = { ...draft, exercises: draft.exercises.map((e, n) => (n === i ? { ...e, ...patch } : e)) };
    emit();
  },
  move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= draft.exercises.length) return;
    const list = [...draft.exercises];
    [list[i], list[j]] = [list[j], list[i]];
    draft = { ...draft, exercises: list };
    emit();
  },
  remove(i: number) {
    draft = { ...draft, exercises: draft.exercises.filter((_, n) => n !== i) };
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useRoutineDraft() {
  return useSyncExternalStore(routineDraft.subscribe, routineDraft.get, routineDraft.get);
}
