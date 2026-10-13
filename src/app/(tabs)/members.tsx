import { useSession } from '../../context/SessionContext';
import { isStaff } from '../../lib/community';
import { MembersScreen } from '../../screens/MembersScreen';
import { SettingsScreen } from '../../screens/SettingsScreen';
export default function Members() { return isStaff(useSession().account) ? <MembersScreen /> : <SettingsScreen />; }
