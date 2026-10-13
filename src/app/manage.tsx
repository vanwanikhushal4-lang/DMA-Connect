import { View } from 'react-native';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { ManageScreen } from '../screens/ManageScreen';
export default function Manage() { return <View style={{ flex: 1 }}><WorkspaceHeader /><ManageScreen /></View>; }
