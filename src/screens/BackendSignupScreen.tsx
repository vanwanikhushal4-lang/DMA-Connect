import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { backendApi, BackendApiError } from '../services/backend-api';
import { createUserPayload, signupAreas } from '../lib/backend-auth';
import type { ApiCommittee, CreateUserResponse } from '../lib/backend-auth';
import { emptyPerson } from '../lib/community';
import type { PersonDraft } from '../lib/community';
import { Screen, ui } from '../components/Screen';
import { PersonForm } from '../components/PersonForm';
import { ActionButton } from '../components/ActionButton';

export function BackendSignupScreen({ onSignIn }: { onSignIn: () => void }) {
  const [committees, setCommittees] = useState<ApiCommittee[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [created, setCreated] = useState<CreateUserResponse | null>(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void backendApi.getAllCommittees(undefined, controller.signal).then(result => {
      if (!active) return;
      setCommittees(result);
      if (!signupAreas(result).length) setError('No active home areas are available. Please try again later.');
    }).catch(cause => {
      if (active) setError(cause instanceof BackendApiError && cause.status === 401
        ? 'The server requires authorization to load signup areas. Please contact the administrator.'
        : cause instanceof Error ? cause.message : 'Home areas could not be loaded.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [retry]);
  async function register(draft: PersonDraft, password = '') {
    const payload = createUserPayload(draft, password, committees);
    const result = await backendApi.createUser(payload);
    setCreated(result);
  }
  return <Screen title={created ? 'Account created' : 'Create your account'} description={created ? 'Your member details have been saved.' : 'Complete your details and choose your home area.'}>
    {created ? <View style={ui.card}>
      <Text style={ui.success}>Your account has been created successfully.</Text>
      {created.emailNeedsVerification && <Text style={ui.body}>Email verification is required for your account.</Text>}
      <ActionButton title="Sign in with email" onPress={onSignIn} />
    </View> : <PersonForm
      initial={emptyPerson}
      requirePassword photosEnabled={false} submitTitle="Create account" onSubmit={register}
      areaOptions={signupAreas(committees).map(c => ({ value: String(c.committeeId), label: c.name }))}
      areasLoading={loading} areasError={error} onRetryAreas={() => { setLoading(true); setError(''); setRetry(value => value + 1); }}
    />}
    {!created && <ActionButton title="Back to email sign in" secondary onPress={onSignIn} />}
  </Screen>;
}
