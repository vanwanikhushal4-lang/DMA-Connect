import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => subscription.remove();
  }, []);
  return reduced;
}

export function useEntrance(delay = 0) {
  const [progress] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: reduced ? 0 : 520, delay: reduced ? 0 : delay, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, delay]);
  return { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 14, 0] }) }] };
}
