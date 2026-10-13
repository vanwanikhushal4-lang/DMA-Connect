import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import Svg, { Circle } from 'react-native-svg';
import { MapPin } from 'lucide-react-native';
import { useEntrance } from '../hooks/useMotion';
import { colors, fonts } from '../theme';

const shades = ['#38206C', '#74569C', '#9C81BC', '#BFADD4', '#DED3EB'];
export function AreaChart({ areas, compact = false }: { areas: { label: string; count: number }[]; compact?: boolean }) {
  const entrance = useEntrance(100);
  const [selected, setSelected] = useState<string | null>(null);
  const top = areas.slice(0, 4);
  if (areas.length > 4) top.push({ label: 'Other areas', count: areas.slice(4).reduce((sum, area) => sum + area.count, 0) });
  const total = areas.reduce((sum, area) => sum + area.count, 0);
  const selection = top.find(area => area.label === selected);
  const circumference = 2 * Math.PI * 51;
  return <View style={[styles.card, !compact && { flex: 0.7 }]}>
    <View style={styles.heading}><View><Text style={styles.title}>Members by home area</Text><Text style={styles.subtitle}>Where your members live</Text></View><MapPin size={18} color="#897599" strokeWidth={1.6} /></View>
    <Animated.View style={[styles.ring, entrance]}>
      <Svg width={150} height={150} viewBox="0 0 150 150">
        <Circle cx={75} cy={75} r={51} fill="none" stroke="#F0EBF6" strokeWidth={17} />
        {top.map((area, index) => {
          const preceding = top.slice(0, index).reduce((sum, item) => sum + item.count, 0);
          const angle = preceding / Math.max(1, total) * 360 - 90;
          const length = area.count / Math.max(1, total) * circumference;
          return <Circle key={area.label} cx={75} cy={75} r={51} fill="none" stroke={shades[index]} strokeWidth={selected === area.label ? 21 : 17}
            strokeDasharray={`${Math.max(0, length - 3)} ${circumference - Math.max(0, length - 3)}`} transform={`rotate(${angle} 75 75)`} />;
        })}
      </Svg>
      <View pointerEvents="none" style={styles.center}><Text style={styles.number}>{selection?.count ?? total}</Text><Text style={styles.centerLabel}>{selection ? 'in this area' : total === 1 ? 'member' : 'members'}</Text></View>
    </Animated.View>
    {top.length ? <View style={styles.legend}>{top.map((area, index) => <Pressable key={area.label} onPress={() => setSelected(previous => previous === area.label ? null : area.label)} accessibilityRole="button" accessibilityLabel={`${area.label}, ${area.count} ${area.count === 1 ? 'member' : 'members'}`} accessibilityState={{ selected: selected === area.label }} style={styles.legendRow}>
      <View style={[styles.dot, { backgroundColor: shades[index] }]} /><Text numberOfLines={1} style={styles.legendLabel}>{area.label}</Text><Text style={styles.legendValue}>{area.count}</Text>
    </Pressable>)}</View> : <Text style={styles.empty}>No home area data available yet.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  card: { borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: 23, minWidth: 0 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }, subtitle: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 6 },
  ring: { width: 150, height: 150, alignSelf: 'center', marginTop: 18, marginBottom: 14 }, center: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }, number: { fontFamily: fonts.bold, fontSize: 28, color: colors.purple, letterSpacing: -1 }, centerLabel: { fontFamily: fonts.regular, fontSize: 9, color: colors.muted, marginTop: 3 },
  legend: { gap: 3 }, legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }, dot: { width: 7, height: 7, borderRadius: 3 }, legendLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 11, color: colors.muted }, legendValue: { fontFamily: fonts.semibold, fontSize: 11, color: colors.ink }, empty: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 19, color: colors.muted, textAlign: 'center', maxWidth: 200, alignSelf: 'center' },
});
