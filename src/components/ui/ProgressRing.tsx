import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  size: number;
  stroke: number;
  /** 0..1 (se recorta; >1 se dibuja completo) */
  progress: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
}

export function ProgressRing({ size, stroke, progress, color = colors.accent, trackColor = colors.track, children }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);

  useEffect(() => {
    p.set(withTiming(Math.min(Math.max(progress, 0), 1), { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [progress, p]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.get()) }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={animatedProps}
        />
      </Svg>
      {children}
    </View>
  );
}
