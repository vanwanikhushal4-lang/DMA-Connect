import { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../context/SessionContext';
import { StartupSplash } from '../components/StartupSplash';
import { colors } from '../theme';

void SplashScreen.preventAutoHideAsync();
export default function RootLayout() {
  const [loaded, error] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });
  useEffect(() => { if (loaded || error) void SplashScreen.hideAsync(); }, [loaded, error]);
  return <SessionProvider><RootNavigator fontsReady={loaded || !!error} /></SessionProvider>;
}
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { profile, loading } = useSession();
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);
  return <View style={styles.root}>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!profile}><Stack.Screen name="account" /></Stack.Protected>
      <Stack.Protected guard={!!profile}><Stack.Screen name="(tabs)" /></Stack.Protected>
    </Stack>
    {!splashDone && <StartupSplash ready={fontsReady && !loading} onFinished={finishSplash} />}
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.white } });
