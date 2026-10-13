import { Tabs } from 'expo-router';
import { ChartNoAxesCombined, Network, Settings, UserRound, UserRoundPlus, UsersRound } from 'lucide-react-native';
import { useSession } from '../context/SessionContext';
import { isStaff } from '../lib/community';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { colors, fonts } from '../theme';

export function WorkspaceTabs() {
  const staff = isStaff(useSession().account);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return <Tabs screenOptions={{ headerShown: false, animation: 'fade', tabBarActiveTintColor: colors.purple, tabBarInactiveTintColor: '#9C91A8', tabBarHideOnKeyboard: true,
    tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border, height: 70 + insets.bottom, paddingTop: 8, paddingBottom: 10 + insets.bottom, paddingHorizontal: Math.max(8, (width - 660) / 2) },
    tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, marginTop: 4 }, tabBarItemStyle: { borderRadius: 12, maxWidth: 220 },
    tabBarActiveBackgroundColor: '#F6F2FB', tabBarLabelPosition: 'below-icon',
  }}>
    <Tabs.Screen name="index" options={{ title: staff ? 'Add member' : 'My profile', tabBarIcon: ({ color }) => staff ? <UserRoundPlus size={23} color={color} /> : <UserRound size={23} color={color} /> }} />
    <Tabs.Screen name="statistics" options={{ title: staff ? 'Statistics' : 'Committees', tabBarIcon: ({ color }) => staff ? <ChartNoAxesCombined size={23} color={color} /> : <Network size={23} color={color} /> }} />
    <Tabs.Screen name="members" options={{ title: staff ? 'Members' : 'Account', tabBarIcon: ({ color }) => staff ? <UsersRound size={23} color={color} /> : <Settings size={23} color={color} /> }} />
  </Tabs>;
}
