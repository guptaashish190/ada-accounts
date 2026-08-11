import constants from '../../renderer/constants';
import {
  canEditSupplyman,
  shouldCascadeBillWithOnSupplymanChange,
  collectSupplyReportBillIds,
} from '../../renderer/services/supplyReportEditUtils';

const SR_STATUS = constants.firebase.supplyReportStatus;

describe('canEditSupplyman', () => {
  test('allows edit for To Accounts, Dispatched, and Delivered', () => {
    expect(canEditSupplyman({ status: SR_STATUS.TOACCOUNTS })).toBe(true);
    expect(canEditSupplyman({ status: SR_STATUS.DISPATCHED })).toBe(true);
    expect(canEditSupplyman({ status: SR_STATUS.DELIVERED })).toBe(true);
  });

  test('blocks edit for Completed and Cancelled', () => {
    expect(canEditSupplyman({ status: SR_STATUS.COMPLETED })).toBe(false);
    expect(canEditSupplyman({ status: SR_STATUS.CANCELLED })).toBe(false);
  });
});

describe('shouldCascadeBillWithOnSupplymanChange', () => {
  test('cascades only after dispatch', () => {
    expect(
      shouldCascadeBillWithOnSupplymanChange({ status: SR_STATUS.TOACCOUNTS }),
    ).toBe(false);
    expect(
      shouldCascadeBillWithOnSupplymanChange({ status: SR_STATUS.DISPATCHED }),
    ).toBe(true);
    expect(
      shouldCascadeBillWithOnSupplymanChange({ status: SR_STATUS.DELIVERED }),
    ).toBe(true);
    expect(
      shouldCascadeBillWithOnSupplymanChange({ status: SR_STATUS.COMPLETED }),
    ).toBe(false);
  });
});

describe('collectSupplyReportBillIds', () => {
  test('deduplicates bill ids from all supply report lists', () => {
    expect(
      collectSupplyReportBillIds({
        orders: ['a', 'b'],
        supplementaryBills: ['b', 'c'],
        attachedBills: ['d'],
      }),
    ).toEqual(['a', 'b', 'c', 'd']);
  });
});
