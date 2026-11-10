import { ComingSoon } from '@/components/ComingSoon';

export default function NutritionScreen() {
  return (
    <ComingSoon
      title="Alimentación"
      items={['Desayuno, almuerzo, cena y snacks', 'Búsqueda y registro de alimentos en gramos', 'Alimentos y recetas personalizadas', 'Editar, eliminar e historial por fecha']}
    />
  );
}
