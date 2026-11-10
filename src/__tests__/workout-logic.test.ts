import { describe, expect, it } from '@jest/globals';

import {
  completedCount, durationMinutes, estimated1RM, formatClock, formatDuration,
  groupByExercise, lastPerformance, restRemaining, volumeKg, weekdaysLabel,
} from '@/features/workouts/logic';

const set = (p: Partial<{ id: string; session_id: string; exercise_id: string; exercise_position: number; set_index: number; reps: number | null; weight_kg: number | null; completed: boolean }>) => ({
  id: 'x', session_id: 's1', exercise_id: 'e1', exercise_position: 0, set_index: 0, reps: 10, weight_kg: 50, completed: true, completed_at: null, ...p,
});

describe('lógica de entrenamiento', () => {
  it('calcula volumen sólo con series completadas', () => {
    expect(volumeKg([set({}), set({ reps: 8, weight_kg: 60 }), set({ completed: false }), set({ weight_kg: null })])).toBe(500 + 480);
    expect(completedCount([set({}), set({ completed: false })])).toBe(1);
  });

  it('formatea tiempos', () => {
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(3909)).toBe('1:05:09');
    expect(formatClock(-3)).toBe('00:00');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(65)).toBe('1 h 5 min');
    expect(durationMinutes('2026-11-10T10:00:00Z', '2026-11-10T11:05:00Z')).toBe(65);
  });

  it('cuenta el descanso restante', () => {
    expect(restRemaining(10_500, 10_000)).toBe(1);
    expect(restRemaining(10_000, 12_000)).toBe(0);
    expect(restRemaining(100_000, 10_000)).toBe(90);
  });

  it('agrupa por ejercicio en el orden de la sesión', () => {
    const g = groupByExercise([
      set({ exercise_id: 'b', exercise_position: 1, set_index: 1 }),
      set({ exercise_id: 'a', exercise_position: 0, set_index: 0 }),
      set({ exercise_id: 'b', exercise_position: 1, set_index: 0 }),
    ]);
    expect(g.map((x) => x.exerciseId)).toEqual(['a', 'b']);
    expect(g[1].sets.map((s) => s.set_index)).toEqual([0, 1]);
  });

  it('toma la última sesión de cada ejercicio', () => {
    const m = lastPerformance([
      set({ session_id: 's3', exercise_id: 'a', set_index: 1, weight_kg: 62.5 }),
      set({ session_id: 's3', exercise_id: 'a', set_index: 0, weight_kg: 60 }),
      set({ session_id: 's2', exercise_id: 'a', set_index: 0, weight_kg: 55 }),
      set({ session_id: 's2', exercise_id: 'b', set_index: 0, weight_kg: 20 }),
    ]);
    expect(m.get('a')!.map((s) => s.weight_kg)).toEqual([60, 62.5]);
    expect(m.get('b')!.map((s) => s.session_id)).toEqual(['s2']);
  });

  it('estima el 1RM y etiqueta días', () => {
    expect(estimated1RM(100, 1)).toBe(100);
    expect(estimated1RM(100, 10)).toBe(133.3);
    expect(estimated1RM(0, 5)).toBe(0);
    expect(weekdaysLabel([5, 1, 3, 3], ['L', 'M', 'X', 'J', 'V', 'S', 'D'])).toBe('L · X · V');
  });
});
