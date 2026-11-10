import { useEffect, useState, useSyncExternalStore } from 'react';

import { restRemaining } from './logic';

/**
 * Temporizador de descanso global. Guarda la HORA DE FIN, no un contador:
 * si bloqueas el móvil o cambias de app, al volver muestra el tiempo correcto.
 */
interface RestState {
  endsAt: number | null;
  total: number;
  label: string;
}

let state: RestState = { endsAt: null, total: 0, label: '' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const restTimer = {
  start(seconds: number, label: string) {
    state = { endsAt: Date.now() + seconds * 1000, total: seconds, label };
    emit();
  },
  add(seconds: number) {
    if (!state.endsAt) return;
    const endsAt = Math.max(Date.now(), state.endsAt + seconds * 1000);
    state = { ...state, endsAt, total: Math.max(1, state.total + seconds) };
    emit();
  },
  stop() {
    state = { endsAt: null, total: 0, label: '' };
    emit();
  },
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** Estado del temporizador, refrescado 4 veces por segundo mientras corre. */
export function useRestTimer() {
  const s = useSyncExternalStore(restTimer.subscribe, restTimer.get, restTimer.get);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!s.endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [s.endsAt]);
  const remaining = s.endsAt ? restRemaining(s.endsAt, now) : 0;
  return { ...s, remaining, running: !!s.endsAt && remaining > 0, finished: !!s.endsAt && remaining === 0 };
}
