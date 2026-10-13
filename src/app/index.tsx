import { Redirect } from 'expo-router';
import { useSession } from '../context/SessionContext';
export default function Index() { const { user, profile, account, loading } = useSession(); if (loading) return null; return <Redirect href={account?.status === 'suspended' ? '/suspended' : user?.phoneNumber && profile?.photoPaths.length && account?.status === 'active' ? '/(tabs)' : '/account'} />; }
