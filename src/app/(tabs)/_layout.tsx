import { MembersProvider } from '../../context/MembersContext';
import { AdminProvider } from '../../context/AdminContext';
import { useSession } from '../../context/SessionContext';
import { WorkspaceHeader } from '../../components/WorkspaceHeader';
import { WorkspaceTabs } from '../../components/WorkspaceTabs';

export default function TabLayout() {
  const { profile } = useSession();
  return (
    <AdminProvider>
      <MembersProvider key={profile?.uid}>
        <WorkspaceHeader />
        <WorkspaceTabs />
      </MembersProvider>
    </AdminProvider>
  );
}
