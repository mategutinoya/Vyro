/**
 * Sistema de diseño de Vyro.
 * Modo oscuro único: negro puro + grafito, con verde lima como acento escaso.
 * Regla: el lima marca progreso y la acción principal, nunca decoración.
 */
export const colors = {
  bg: '#000000',
  surface: '#111113',
  surfaceRaised: '#1A1A1D',
  surfacePressed: '#232327',
  border: '#26262B',
  hairline: '#1C1C20',

  text: '#F5F5F7',
  textSecondary: '#9A9AA2',
  textTertiary: '#5E5E66',

  accent: '#C6F432', // verde lima
  accentDim: 'rgba(198, 244, 50, 0.14)',
  onAccent: '#0A0A0A',

  // Macros: tonos apagados para no competir con el acento.
  protein: '#C6F432',
  carbs: '#7DD3FC',
  fat: '#F5B971',
  water: '#5AB8FF',

  danger: '#FF5D5D',
  dangerDim: 'rgba(255, 93, 93, 0.14)',
  track: '#222226',
} as const;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  black: 'Inter_800ExtraBold',
} as const;

export const type = {
  display: { fontFamily: fonts.black, fontSize: 44, lineHeight: 48, letterSpacing: -1.6 },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.8 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.3 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17 },
  overline: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' as const },
  metric: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 26, letterSpacing: -0.6, fontVariant: ['tabular-nums' as const] },
} as const;

export type TypeVariant = keyof typeof type;
