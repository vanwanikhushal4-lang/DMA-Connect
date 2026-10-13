import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS } from 'react-native';
import { colors, fonts } from '../theme';
import { useSession } from '../context/SessionContext';
import { isStaff } from '../lib/community';

const selectedColor = DynamicColorIOS({ light: colors.purple, dark: '#D9C5F5' });
const inactiveColor = DynamicColorIOS({ light: colors.muted, dark: '#D8D0E2' });

export function WorkspaceTabs() {
  const staff = isStaff(useSession().account);
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
      <NativeTabs.Trigger name="index" accessibilityLabel={staff ? 'Add member tab' : 'My profile tab'} contentStyle={{ backgroundColor: colors.background }}>
        <NativeTabs.Trigger.Icon sf={staff ? { default: 'person.badge.plus', selected: 'person.badge.plus.fill' } : { default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} />
        <NativeTabs.Trigger.Label>{staff ? 'Add member' : 'My profile'}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="statistics" accessibilityLabel="Statistics tab" contentStyle={{ backgroundColor: colors.background }}>
        <NativeTabs.Trigger.Icon sf={staff ? { default: 'chart.bar', selected: 'chart.bar.fill' } : { default: 'rectangle.3.group', selected: 'rectangle.3.group.fill' }} />
        <NativeTabs.Trigger.Label>{staff ? 'Statistics' : 'Committees'}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="members" accessibilityLabel="Members tab" contentStyle={{ backgroundColor: colors.background }}>
        <NativeTabs.Trigger.Icon sf={staff ? { default: 'person.2', selected: 'person.2.fill' } : { default: 'gearshape', selected: 'gearshape.fill' }} />
        <NativeTabs.Trigger.Label>{staff ? 'Members' : 'Account'}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
