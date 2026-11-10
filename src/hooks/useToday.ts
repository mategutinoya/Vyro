import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayISO } from '@/lib/date';

/** Fecha local de hoy; se actualiza si la app vuelve a primer plano tras la medianoche. */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setToday(todayISO());
    });
    return () => sub.remove();
  }, []);
  return today;
}
