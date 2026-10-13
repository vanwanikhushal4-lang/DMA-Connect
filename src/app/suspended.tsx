import { Text, View } from 'react-native';
import { Screen, ui } from '../components/Screen';
import { ActionButton } from '../components/ActionButton';
import { useSession } from '../context/SessionContext';
export default function Suspended() { const { signOut } = useSession(); return <Screen title="Account suspended" description="Contact the district Super Admin to review your account."><View style={ui.card}><Text style={ui.body}>Your profile and previous actions have been preserved.</Text><ActionButton title="Sign out" onPress={() => void signOut()} /></View></Screen>; }
