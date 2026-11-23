// Incrementar cuando cambie el contenido del aviso que debe volver a mostrarse.
export const PRIVACY_NOTICE_VERSION = 1;
export const PRIVACY_NOTICE_STORAGE_KEY = 'cora_privacy_notice';
const changedEvent = 'cora-privacy-notice';

export interface PrivacyAcknowledgement {
  version: number;
  acknowledgedAt: string;
}

export function parsePrivacyAcknowledgement(raw: string | null): PrivacyAcknowledgement | null {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (value?.version !== PRIVACY_NOTICE_VERSION ||
      typeof value?.acknowledgedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(value.acknowledgedAt) ||
      !Number.isFinite(Date.parse(value.acknowledgedAt)) ||
      Date.parse(value.acknowledgedAt) > Date.now()) return null;
    return { version: PRIVACY_NOTICE_VERSION, acknowledgedAt: value.acknowledgedAt };
  } catch { return null; }
}

export function getPrivacyNoticeSnapshot(): string | null {
  try { return localStorage.getItem(PRIVACY_NOTICE_STORAGE_KEY); } catch { return null; }
}

// Solo recuerda la lectura; no autoriza tratamientos ni cambia otras preferencias.
export function acknowledgePrivacyNotice(): boolean {
  const value: PrivacyAcknowledgement = {
    version: PRIVACY_NOTICE_VERSION,
    acknowledgedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(PRIVACY_NOTICE_STORAGE_KEY, JSON.stringify(value));
  } catch { return false; }
  window.dispatchEvent(new Event(changedEvent));
  return true;
}

export function subscribePrivacyNotice(listener: () => void): () => void {
  const sync = (event: StorageEvent) => {
    if (event.key === PRIVACY_NOTICE_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(changedEvent, listener);
  window.addEventListener('storage', sync);
  return () => {
    window.removeEventListener(changedEvent, listener);
    window.removeEventListener('storage', sync);
  };
}
