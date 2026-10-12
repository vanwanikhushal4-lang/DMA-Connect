import { Redirect } from 'expo-router';
import { useSession } from '../context/SessionContext';
export default function Index() {
  const { profile, isAdmin, loading } = useSession();
  if (loading) return null;
  // Admins have no president profile — redirect them to the workspace directly.
  const hasAccess = !!profile || isAdmin;
  return <Redirect href={hasAccess ? '/(tabs)' : '/account'} />;
}
