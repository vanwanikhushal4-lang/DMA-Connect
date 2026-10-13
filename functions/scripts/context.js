import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function argument(name, fallback = '') {
  const index = process.argv.indexOf('--' + name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
export const apply = process.argv.includes('--apply');
export const projectId = argument('project', process.env.GCLOUD_PROJECT || 'dma-connect-foundation');
const emulated = !!process.env.FIRESTORE_EMULATOR_HOST;
if (emulated && (!projectId.startsWith('demo-') || !process.env.FIREBASE_AUTH_EMULATOR_HOST)) throw new Error('Use a demo project with both Auth and Firestore emulators.');
initializeApp({ projectId, ...(emulated ? {} : { credential: applicationDefault() }), storageBucket: `${projectId}.firebasestorage.app` });
export const auth = getAuth();
export const db = getFirestore('dma-connect');
