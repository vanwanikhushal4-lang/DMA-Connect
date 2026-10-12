import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export function Brand({ large = false }: { large?: boolean }) {
  return <View style={[styles.row, large && styles.largeRow]}>
    <Image source={require('../../assets/foundation-logo.png')} style={[styles.logo, large && styles.largeLogo]} resizeMode="contain" accessibilityLabel="Dr. Mangesh Amale Foundation logo" />
    <View><Text style={[styles.name, large && styles.largeName]}>DMA <Text style={styles.connect}>connect</Text></Text>
      <Text style={[styles.caption, large && styles.largeCaption]}>DR. MANGESH AMALE FOUNDATION</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, largeRow: { flexDirection: 'column', gap: 23 },
  logo: { width: 42, height: 42 }, largeLogo: { width: 112, height: 104 },
  name: { color: colors.purple, fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.8 }, largeName: { fontSize: 36, textAlign: 'center', letterSpacing: -1.5 },
  connect: { fontFamily: fonts.medium }, caption: { fontFamily: fonts.medium, color: '#82798E', fontSize: 7.5, letterSpacing: 0.75, marginTop: 3 },
  largeCaption: { fontSize: 8, letterSpacing: 1.5, marginTop: 8, textAlign: 'center' },
});
