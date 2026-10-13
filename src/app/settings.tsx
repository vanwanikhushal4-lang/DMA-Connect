import { View } from 'react-native';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { SettingsScreen } from '../screens/SettingsScreen';
export default function Settings() { return <View style={{ flex: 1 }}><WorkspaceHeader /><SettingsScreen /></View>; }
