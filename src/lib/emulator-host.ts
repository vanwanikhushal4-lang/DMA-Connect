export function resolveEmulatorHost(override?: string, hostUri?: string | null) {
  if (override?.trim()) return override.trim();
  if (hostUri) {
    try { return new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`).hostname; }
    catch { /* A preview without a valid Metro host can use local services. */ }
  }
  return 'localhost';
}
