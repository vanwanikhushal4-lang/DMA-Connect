import { useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, fonts } from '../theme';
import { useReducedMotion } from '../hooks/useMotion';

export function ActionButton({ title, onPress, busy = false, disabled = false, icon: Icon, secondary = false }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; icon?: LucideIcon; secondary?: boolean;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  const animate = (value: number) => Animated.spring(scale, { toValue: reduced ? 1 : value, useNativeDriver: Platform.OS !== 'web', speed: 30, bounciness: 0 }).start();
  return <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.5 : 1 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: busy || disabled, busy }}
      disabled={busy || disabled} onPress={onPress} onPressIn={() => animate(0.975)} onPressOut={() => animate(1)}
      style={[styles.button, secondary && styles.secondary]}>
      {busy ? <ActivityIndicator color={secondary ? colors.purple : colors.white} size="small" /> : Icon && <Icon size={19} color={secondary ? colors.purple : colors.white} strokeWidth={1.7} />}
      <Text style={[styles.title, secondary && { color: colors.purple }]}>{title}</Text>
      {!busy && !secondary && <ArrowRight size={18} color={colors.white} />}
    </Pressable>
  </Animated.View>;
}
const styles = StyleSheet.create({
  button: { minHeight: 51, paddingHorizontal: 20, borderRadius: 11, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 11, backgroundColor: colors.purple },
  secondary: { backgroundColor: colors.lavender, borderWidth: 1, borderColor: colors.lavenderBorder },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.white },
});
