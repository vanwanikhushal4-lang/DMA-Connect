import { StyleSheet, View } from 'react-native';
import { Heart, UserRound, UsersRound } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export function CommunityIllustration() {
  return (
    <View style={styles.canvas} accessible={false}>
      <Svg width={248} height={190} viewBox="0 0 248 190" style={StyleSheet.absoluteFill}>
        <Circle cx="124" cy="101" r="65" fill="none" stroke="#DDD2ED" strokeWidth="1" />
        <Circle cx="124" cy="101" r="90" fill="none" stroke="#E8E0F1" strokeWidth="1" strokeDasharray="3 6" />
        <Path d="M72 67 L124 101 L181 54 M124 101 L184 144 M124 101 L52 139" fill="none" stroke="#D8CCE7" strokeWidth="1.2" />
        <Circle cx="112" cy="12" r="3" fill="#B9A6D1" /><Circle cx="213" cy="103" r="3" fill="#B9A6D1" /><Circle cx="147" cy="164" r="3" fill="#B9A6D1" />
      </Svg>
      <View style={[styles.person, { left: 46, top: 40 }]}><UserRound size={25} color="#8C72AC" strokeWidth={1.4} /></View>
      <View style={[styles.person, { left: 158, top: 28 }]}><UserRound size={25} color="#8C72AC" strokeWidth={1.4} /></View>
      <View style={[styles.person, { left: 161, top: 122 }]}><UserRound size={24} color="#8C72AC" strokeWidth={1.4} /></View>
      <View style={[styles.person, { left: 26, top: 116 }]}><Heart size={23} color="#8C72AC" strokeWidth={1.4} /></View>
      <View style={styles.center}><UsersRound size={32} color="#6A4596" strokeWidth={1.45} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: 248, height: 190, alignSelf: 'center' },
  person: { position: 'absolute', width: 48, height: 48, borderRadius: 24, backgroundColor: '#FBF9FF', borderWidth: 1, borderColor: '#E0D6EC', alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', left: 88, top: 65, width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7C8E8', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(80, 46, 126, 0.06)' },
});
