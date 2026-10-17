const key = 'dma-connect.backend-session';

// Keep web sessions in this browser tab; passwords are never persisted.
export async function loadBackendSession(): Promise<string | null> {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key); } catch { return null; }
}
export async function saveBackendSession(value: string): Promise<void> {
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value);
}
export async function clearBackendSession(): Promise<void> {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
}
