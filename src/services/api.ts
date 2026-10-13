import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { emulatorHost, firebaseApp, usingEmulators } from './firebase';
const functions = getFunctions(firebaseApp, 'asia-south1');
if (usingEmulators) connectFunctionsEmulator(functions, emulatorHost, 5001);
const callable = httpsCallable(functions, 'dmaApi', { timeout: 120000 });
export async function api<T = { ok: boolean }>(operation: string, payload: object = {}): Promise<T> {
  try { return (await callable({ operation, payload })).data as T; }
  catch (cause) {
    const error = cause as { code?: string; message?: string };
    if (error.code === 'functions/unavailable') throw new Error('The server is unavailable. Check your connection and try again.');
    throw new Error(error.message || 'The action could not be completed. Please retry.');
  }
}
