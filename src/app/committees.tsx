import { View } from 'react-native';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { CommitteeScreen } from '../screens/CommitteeScreen';
export default function Committees() { return <View style={{ flex: 1 }}><WorkspaceHeader /><CommitteeScreen /></View>; }
