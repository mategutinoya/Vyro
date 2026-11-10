import { ComingSoon } from '@/components/ComingSoon';

export default function ProgressScreen() {
  return (
    <ComingSoon
      title="Progreso"
      items={['Registro de peso corporal', 'Gráficos de evolución', 'Estadísticas nutricionales', 'Progresión por ejercicio']}
    />
  );
}
