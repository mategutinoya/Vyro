import { useEffect, useState } from 'react';

/** Devuelve el valor tras `ms` sin cambios (para no lanzar una búsqueda por cada tecla). */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
