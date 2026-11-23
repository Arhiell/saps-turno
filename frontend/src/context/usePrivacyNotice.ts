import { useSyncExternalStore } from 'react';
import { getPrivacyNoticeSnapshot, parsePrivacyAcknowledgement, subscribePrivacyNotice } from '../utils/privacy-notice';

export default function usePrivacyNotice() {
  return parsePrivacyAcknowledgement(useSyncExternalStore(subscribePrivacyNotice, getPrivacyNoticeSnapshot, () => null));
}
