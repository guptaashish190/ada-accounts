import {
  BUNDLE_EDIT_WINDOW_MS,
  buildRemovedBillOrderUpdate,
  canEditBundle,
  filterOrderDetailsForBills,
  filterPartyPaymentsForParties,
  getBillsRemovedFromBundle,
  getRemovedBundleBillIds,
} from '../../renderer/services/bundleEditUtils';
import constants from '../../renderer/constants';

describe('canEditBundle', () => {
  const now = Date.now();

  test('allows edit within 24 hours for non-manager', () => {
    expect(
      canEditBundle({ timestamp: now - BUNDLE_EDIT_WINDOW_MS + 1000 }, false),
    ).toBe(true);
  });

  test('blocks edit after 24 hours for non-manager', () => {
    expect(
      canEditBundle({ timestamp: now - BUNDLE_EDIT_WINDOW_MS - 1 }, false),
    ).toBe(false);
  });

  test('allows edit after 24 hours for manager', () => {
    expect(
      canEditBundle({ timestamp: now - BUNDLE_EDIT_WINDOW_MS - 1 }, true),
    ).toBe(true);
  });

  test('blocks non-manager when timestamp missing', () => {
    expect(canEditBundle({}, false)).toBe(false);
  });

  test('blocks edit for handover bundles even for managers', () => {
    expect(
      canEditBundle(
        {
          status: constants.firebase.billBundleFlowStatus.HANDOVER,
          timestamp: now,
        },
        true,
      ),
    ).toBe(false);
  });
});
