import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS } from 'react-native';
import { colors, fonts } from '../theme';

const selectedColor = DynamicColorIOS({ light: colors.purple, dark: '#D9C5F5' });
const inactiveColor = DynamicColorIOS({ light: colors.muted, dark: '#D8D0E2' });

export function WorkspaceTabs() {
  return (
    <NativeTabs
      tintColor={selectedColor}
      iconColor={{ default: inactiveColor, selected: selectedColor }}
      labelStyle={{
        default: { fontFamily: fonts.semibold, fontSize: 11, color: inactiveColor },
        selected: { fontFamily: fonts.semibold, fontSize: 11, color: selectedColor },
      }}
      minimizeBehavior="never"
      sidebarAdaptable={false}
      disableTransparentOnScrollEdge
    >
      <NativeTabs.Trigger name="index" accessibilityLabel="Add member tab" contentStyle={{ backgroundColor: colors.background }}>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.badge.plus', selected: 'person.badge.plus.fill' }} />
        <NativeTabs.Trigger.Label>Add member</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="statistics" accessibilityLabel="Statistics tab" contentStyle={{ backgroundColor: colors.background }}>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} />
        <NativeTabs.Trigger.Label>Statistics</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile" accessibilityLabel="Account tab" contentStyle={{ backgroundColor: colors.background }}>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} />
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
