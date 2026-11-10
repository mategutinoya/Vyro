const nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

export const fmt = (n: number) => nf.format(Math.round(n));
export const fmt1 = (n: number) => nf1.format(n);

/** 1500 -> "1,5 L", 750 -> "750 ml" */
export function fmtWater(ml: number): string {
  return ml >= 1000 ? `${nf1.format(ml / 1000)} L` : `${fmt(ml)} ml`;
}
