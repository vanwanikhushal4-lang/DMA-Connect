import { Tabs } from 'expo-router';
import { ChartNoAxesCombined, UserRound, UserRoundPlus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { colors, fonts } from '../theme';

export function WorkspaceTabs() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return <Tabs screenOptions={{ headerShown: false, animation: 'fade', tabBarActiveTintColor: colors.purple, tabBarInactiveTintColor: '#9C91A8', tabBarHideOnKeyboard: true,
    tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border, height: 70 + insets.bottom, paddingTop: 8, paddingBottom: 10 + insets.bottom, paddingHorizontal: Math.max(8, (width - 440) / 2) },
    tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, marginTop: 4 }, tabBarItemStyle: { borderRadius: 12, maxWidth: 220 },
    tabBarActiveBackgroundColor: '#F6F2FB', tabBarLabelPosition: 'below-icon',
  }}>
    <Tabs.Screen name="index" options={{ title: 'Add member', tabBarAccessibilityLabel: 'Add member tab', tabBarIcon: ({ color, focused }) => <UserRoundPlus size={23} color={color} strokeWidth={focused ? 2 : 1.6} /> }} />
    <Tabs.Screen name="statistics" options={{ title: 'Statistics', tabBarAccessibilityLabel: 'Statistics tab', tabBarIcon: ({ color, focused }) => <ChartNoAxesCombined size={23} color={color} strokeWidth={focused ? 2 : 1.6} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Account', tabBarAccessibilityLabel: 'Account tab', tabBarIcon: ({ color, focused }) => <UserRound size={23} color={color} strokeWidth={focused ? 2 : 1.6} /> }} />
  </Tabs>;
}
