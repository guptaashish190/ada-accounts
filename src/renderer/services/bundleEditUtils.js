import constants from '../constants';

export const BUNDLE_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Handed-over bundles cannot be edited. Non-managers may edit only within 24h of creation. */
export function canEditBundle(bundle, isManager = false) {
  if (bundle?.status === constants.firebase.billBundleFlowStatus.HANDOVER) {
    return false;
  }
  if (isManager) return true;
  const timestamp = bundle?.timestamp;
  if (!timestamp) return false;
  return Date.now() - timestamp <= BUNDLE_EDIT_WINDOW_MS;
}
