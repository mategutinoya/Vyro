import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, radius } from '@/theme/tokens';

interface Props {
  progress: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ progress, color = colors.accent, height = 6 }: Props) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(Math.min(Math.max(progress, 0), 1), { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, [progress, p]);
  const fill = useAnimatedStyle(() => ({ width: `${p.get() * 100}%` }));

  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: radius.pill, backgroundColor: color }, fill]} />
    </View>
  );
}
