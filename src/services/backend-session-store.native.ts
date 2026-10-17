import * as SecureStore from 'expo-secure-store';

const key = 'dma-connect.backend-session';
export function loadBackendSession() { return SecureStore.getItemAsync(key); }
export function saveBackendSession(value: string) { return SecureStore.setItemAsync(key, value); }
export function clearBackendSession() { return SecureStore.deleteItemAsync(key); }
