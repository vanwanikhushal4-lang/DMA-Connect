import { useSession } from '../../context/SessionContext';
import { isStaff } from '../../lib/community';
import { MemberRegistration } from '../../screens/MemberRegistration';
import { ProfileScreen } from '../../screens/ProfileScreen';
export default function Home() { return isStaff(useSession().account) ? <MemberRegistration /> : <ProfileScreen />; }
