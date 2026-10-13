import { useSession } from '../../context/SessionContext';
import { isStaff, isMaker, isChecker } from '../../lib/community';
import { MemberRegistration } from '../../screens/MemberRegistration';
import { ProfileScreen } from '../../screens/ProfileScreen';
import { ManageScreen } from '../../screens/ManageScreen';
import { WorkScreen } from '../../screens/WorkScreen';
export default function Home() {
  const { account } = useSession();
  if (isMaker(account)) return <MemberRegistration />;
  if (isChecker(account)) return <WorkScreen />;
  return isStaff(account) ? <ManageScreen overviewOnly /> : <ProfileScreen />;
}
