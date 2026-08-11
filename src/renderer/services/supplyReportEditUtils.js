import constants from '../constants';

const SR_STATUS = constants.firebase.supplyReportStatus;

export const SUPPLYMAN_EDITABLE_STATUSES = [
  SR_STATUS.TOACCOUNTS,
  SR_STATUS.DISPATCHED,
  SR_STATUS.DELIVERED,
];

/** Supplyman may be edited only before receive completes or cancellation. */
export function canEditSupplyman(supplyReport) {
  return SUPPLYMAN_EDITABLE_STATUSES.includes(supplyReport?.status);
}

/** After dispatch, bills carry `with = supplymanId` and must follow supplyman changes. */
export function shouldCascadeBillWithOnSupplymanChange(supplyReport) {
  const status = supplyReport?.status;
  return (
    status === SR_STATUS.DISPATCHED || status === SR_STATUS.DELIVERED
  );
}

export function collectSupplyReportBillIds(supplyReport) {
  const ids = new Set([
    ...(supplyReport?.orders || []),
    ...(supplyReport?.supplementaryBills || []),
    ...(supplyReport?.attachedBills || []),
  ]);
  return [...ids];
}
