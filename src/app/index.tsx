import { Redirect } from 'expo-router';
import { useSession } from '../context/SessionContext';
import { useBackendAuth } from '../context/BackendAuthContext';
import { backendApiEnabled } from '../services/backend-api';
export default function Index() {
  const { user, profile, account, loading } = useSession();
  const backend = useBackendAuth();
  if (backendApiEnabled) return backend.loading ? null : <Redirect href={backend.session ? '/backend-account' : '/account'} />;
  if (loading) return null;
  return <Redirect href={account?.status === 'suspended' ? '/suspended' : user?.phoneNumber && profile?.photoPaths.length && account?.status === 'active' ? '/(tabs)' : '/account'} />;
}
