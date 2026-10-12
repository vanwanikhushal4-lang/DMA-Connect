import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { Brand } from './Brand';
import { colors, fonts } from '../theme';
import { useReducedMotion } from '../hooks/useMotion';

export function StartupSplash({ ready, onFinished }: { ready: boolean; onFinished: () => void }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: reduced ? 0 : 750, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  useEffect(() => {
    if (!ready) return;
    const animation = Animated.sequence([
      Animated.delay(reduced ? 100 : 1250),
      Animated.timing(opacity, { toValue: 0, duration: reduced ? 0 : 380, useNativeDriver: Platform.OS !== 'web' }),
    ]);
    animation.start(({ finished }) => { if (finished) onFinished(); });
    return () => animation.stop();
  }, [ready, reduced, opacity, onFinished]);
  return <Animated.View style={[styles.screen, { opacity }]} accessibilityViewIsModal testID="startup-splash">
    <View style={styles.orbit} /><View style={styles.innerOrbit} />
    <Animated.View style={{ opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
      <Brand large />
    </Animated.View>
    <View style={styles.bottom}><ActivityIndicator color={colors.purple} size="small" /><Text style={styles.caption}>DMA Connect</Text><Text style={styles.version}>MEMBER MANAGEMENT · v1.0</Text></View>
  </Animated.View>;
}
const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: colors.white, zIndex: 100, alignItems: 'center', justifyContent: 'center' },
  orbit: { position: 'absolute', width: 380, height: 380, borderRadius: 190, borderWidth: 1, borderColor: '#F3EFF8' },
  innerOrbit: { position: 'absolute', width: 280, height: 280, borderRadius: 140, borderWidth: 1, borderColor: '#F6F3FA', marginTop: -55 },
  bottom: { position: 'absolute', bottom: 60, alignItems: 'center', gap: 14 }, caption: { color: colors.muted, fontSize: 12, fontFamily: fonts.medium },
  version: { color: '#ACA3B4', fontSize: 8, fontFamily: fonts.medium, letterSpacing: 1.4 },
});
