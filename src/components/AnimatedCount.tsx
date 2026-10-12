import { useEffect, useState } from 'react';
import { Animated, Easing, Text } from 'react-native';
import type { TextStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useMotion';

export function AnimatedCount({ value, style }: { value: number; style?: TextStyle }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [display, setDisplay] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    const id = progress.addListener(({ value: next }) => setDisplay(Math.round(next)));
    const animation = Animated.timing(progress, { toValue: value, duration: reduced ? 0 : 650, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => { animation.stop(); progress.removeListener(id); };
  }, [value, progress, reduced]);
  return <Text style={style} accessibilityLabel={String(value)}>{display.toLocaleString('en-IN')}</Text>;
}
