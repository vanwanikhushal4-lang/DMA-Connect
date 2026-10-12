import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { TrendingUp } from 'lucide-react-native';
import { colors, fonts } from '../theme';
import { useReducedMotion } from '../hooks/useMotion';

export function RegistrationChart({ points, subtitle, compact = false }: { points: { label: string; fullLabel: string; count: number }[]; subtitle: string; compact?: boolean }) {
  const [progress] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  const [selection, setSelection] = useState<number | null>(null);
  const maximum = Math.max(1, ...points.map(point => point.count));
  const peak = maximum <= 4 ? 4 : Math.ceil(maximum / 4) * 4;
  const dataKey = points.map(point => `${point.label}:${point.count}`).join('|');
  const total = points.reduce((sum, point) => sum + point.count, 0);
  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: reduced ? 0 : 780, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start(); return () => animation.stop();
  }, [dataKey, progress, reduced]);
  const selected = selection !== null && selection < points.length ? points[selection] : null;
  return <View style={[styles.card, !compact && { flex: 1 }]}>
    <View style={styles.heading}><View><Text style={styles.title}>Registration activity</Text><Text style={styles.subtitle}>{subtitle}</Text></View><View style={styles.icon}><TrendingUp size={18} color={colors.purple} strokeWidth={1.7} /></View></View>
    <View style={styles.detail}><View style={styles.legendDot} /><Text style={styles.detailText}>{selected ? `${selected.fullLabel} · ${selected.count} ${selected.count === 1 ? 'member' : 'members'}` : 'Members added'}</Text></View>
    <View style={styles.plot}>
      {[0, 1, 2, 3, 4].map(index => <View key={index} style={[styles.gridline, { bottom: index * 39 }]}><Text style={styles.tick}>{Math.round(peak * index / 4)}</Text><View style={styles.line} /></View>)}
      <View style={styles.bars}>{points.map((point, index) => {
        const height = point.count / peak * 156;
        return <Pressable key={`${point.fullLabel}-${index}`} accessibilityRole="button" accessibilityLabel={`${point.fullLabel}: ${point.count} ${point.count === 1 ? 'member' : 'members'}`} accessibilityState={{ selected: index === selection }} hitSlop={points.length > 7 ? 4 : undefined} onPress={() => setSelection(index)} style={styles.barSlot}>
          <Animated.View style={[styles.bar, { height: Math.max(point.count ? 5 : 0, height), backgroundColor: index === selection ? '#6F4AA0' : colors.purple,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height / 2, 0] }) }, { scaleY: progress.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] }) }],
          }]} />
        </Pressable>;
      })}</View>
      {total === 0 && <View pointerEvents="none" style={styles.empty}><Text style={styles.emptyTitle}>Your activity will appear here</Text><Text style={styles.emptyText}>No registrations for this period yet.</Text></View>}
    </View>
    <View style={[styles.labels, points.length > 7 && styles.denseLabels]}>{points.filter((_, index) => points.length <= 7 || index % 5 === 0 || index === points.length - 1).map(point => <Text key={point.fullLabel} style={[styles.axisLabel, points.length > 7 && styles.denseAxisLabel]}>{point.label}</Text>)}</View>
    <Text style={styles.footnote}>Tap a bar to see its registration count.</Text>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 17, padding: 23, minWidth: 0 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }, subtitle: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 6 }, icon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lavender, borderRadius: 10 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 21, marginBottom: 20 }, legendDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.purple }, detailText: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted },
  plot: { height: 157, position: 'relative' }, gridline: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }, tick: { width: 19, fontFamily: fonts.regular, color: '#A398AF', fontSize: 9, textAlign: 'right' }, line: { height: 1, flex: 1, backgroundColor: '#F1EDF5' },
  bars: { position: 'absolute', left: 32, right: 0, top: 0, bottom: 0, flexDirection: 'row', gap: 5, alignItems: 'flex-end' }, barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', minWidth: 0 }, bar: { width: '68%', maxWidth: 35, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  labels: { flexDirection: 'row', gap: 5, marginLeft: 32, marginTop: 12 }, axisLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.regular, color: '#9D91A9', fontSize: 9 },
  denseLabels: { justifyContent: 'space-between', gap: 0 }, denseAxisLabel: { flex: 0, minWidth: 14 },
  empty: { position: 'absolute', top: 33, left: 32, right: 0, alignItems: 'center', padding: 15, backgroundColor: 'rgba(255,255,255,0.85)' }, emptyTitle: { fontFamily: fonts.medium, fontSize: 12, color: '#806A94' }, emptyText: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted, marginTop: 7 }, footnote: { fontFamily: fonts.regular, fontSize: 9, color: '#ABA0B4', marginTop: 20 },
});
