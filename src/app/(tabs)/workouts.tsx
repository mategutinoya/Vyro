import { ComingSoon } from '@/components/ComingSoon';

export default function WorkoutsScreen() {
  return (
    <ComingSoon
      title="Entrenamiento"
      items={['Rutinas y ejercicios', 'Series, repeticiones y peso', 'Temporizador de descanso', 'Historial de sesiones']}
    />
  );
}
