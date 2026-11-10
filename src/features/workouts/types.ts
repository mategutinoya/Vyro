export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'legs' | 'glutes' | 'core' | 'full_body' | 'cardio' | 'other';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band' | 'other';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  legs: 'Piernas',
  glutes: 'Glúteos',
  core: 'Core',
  full_body: 'Cuerpo completo',
  cardio: 'Cardio',
  other: 'Otro',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barra',
  dumbbell: 'Mancuernas',
  machine: 'Máquina',
  cable: 'Polea',
  bodyweight: 'Peso corporal',
  kettlebell: 'Kettlebell',
  band: 'Banda',
  other: 'Otro',
};

/** Días ISO: 1 = lunes … 7 = domingo. */
export const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export interface Exercise {
  id: string;
  user_id: string | null;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment | null;
}

export interface RoutineExercise {
  exercise: Exercise;
  target_sets: number;
  target_reps: number | null;
  rest_seconds: number;
}

export interface Routine {
  id: string;
  name: string;
  notes: string | null;
  weekdays: number[];
  position: number;
  exercises: RoutineExercise[];
}

export interface WorkoutSet {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise_position: number;
  set_index: number;
  reps: number | null;
  weight_kg: number | null;
  completed: boolean;
  completed_at: string | null;
}

export interface WorkoutSession {
  id: string;
  routine_id: string | null;
  name: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}
