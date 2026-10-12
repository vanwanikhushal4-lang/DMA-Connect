import { MembersProvider } from '../../context/MembersContext';
import { useSession } from '../../context/SessionContext';
import { WorkspaceHeader } from '../../components/WorkspaceHeader';
import { WorkspaceTabs } from '../../components/WorkspaceTabs';

export default function TabLayout() {
  const { profile } = useSession();
  return <MembersProvider key={profile?.uid}>
    <WorkspaceHeader />
    <WorkspaceTabs />
  </MembersProvider>;
}
