import { Redirect } from 'expo-router';
import { useSession } from '../context/SessionContext';
export default function Index() { const { profile, loading } = useSession(); if (loading) return null; return <Redirect href={profile ? '/(tabs)' : '/account'} />; }
