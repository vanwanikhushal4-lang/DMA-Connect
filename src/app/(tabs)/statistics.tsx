import { useSession } from '../../context/SessionContext';
import { isStaff } from '../../lib/community';
import { StatisticsScreen } from '../../screens/StatisticsScreen';
import { CommitteeScreen } from '../../screens/CommitteeScreen';
export default function Statistics() { return isStaff(useSession().account) ? <StatisticsScreen /> : <CommitteeScreen />; }
