import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { firebaseConfig, databaseId } from './firebase-config';

export const usingEmulators = __DEV__ && process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
export const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || 'localhost';
const config = usingEmulators ? { ...firebaseConfig, projectId: 'demo-dma-connect', authDomain: 'demo-dma-connect.firebaseapp.com' } : firebaseConfig;
const appName = usingEmulators ? 'dma-connect-emulator' : '[DEFAULT]';
export const firebaseApp = getApps().some(app => app.name === appName) ? getApp(appName) : initializeApp(config, appName);
export const db = initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true }, databaseId);
if (usingEmulators) connectFirestoreEmulator(db, emulatorHost, 8180);
