'use client';

/** Llama a una ruta de la API y devuelve el JSON o lanza un Error con el mensaje en español. */
export async function postJSON<T = unknown>(url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  } catch {
    throw new Error('Sin conexión. Revisa tu internet e inténtalo de nuevo.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
  return data as T;
}
