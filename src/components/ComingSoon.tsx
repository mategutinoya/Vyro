import { AppText, Card, Screen } from '@/components/ui';
import { colors, space } from '@/theme/tokens';

/** Marcador honesto para secciones todavía no implementadas. */
export function ComingSoon({ title, items }: { title: string; items: string[] }) {
  return (
    <Screen>
      <AppText variant="title" style={{ marginBottom: space.sm }}>{title}</AppText>
      <Card style={{ gap: space.md }}>
        <AppText variant="overline" color={colors.accent}>Siguiente etapa</AppText>
        <AppText color={colors.textSecondary}>Esta sección se construirá en la próxima etapa del MVP. Incluirá:</AppText>
        {items.map((i) => (
          <AppText key={i} variant="body">·  {i}</AppText>
        ))}
      </Card>
    </Screen>
  );
}
