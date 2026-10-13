import { MembersProvider } from '../../context/MembersContext';
import { useSession } from '../../context/SessionContext';
import { WorkspaceHeader } from '../../components/WorkspaceHeader';
import { WorkspaceTabs } from '../../components/WorkspaceTabs';

export default function TabLayout() {
  const { account } = useSession();
  return <MembersProvider key={account?.uid}>
    <WorkspaceHeader />
    <WorkspaceTabs />
  </MembersProvider>;
}
