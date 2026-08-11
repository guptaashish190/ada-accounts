/**
 * Custody handover amounts live on billBundles.assignmentDetails — not on order.balance
 * (ERP sync owns order.balance via outstanding import).
 */

export const getErpBalance = (bill) => Number(bill?.balance ?? 0);

export const getStoredLastHandover = (bill) => {
  if (
    bill?.lastHandoverBalance != null
    && !Number.isNaN(Number(bill.lastHandoverBalance))
  ) {
    return Number(bill.lastHandoverBalance);
  }
  return null;
};

/** Default handover when attaching / prefilling assign UI. */
export const getDefaultHandoverBalance = (bill) =>
  getStoredLastHandover(bill) ?? getErpBalance(bill);

export const getHandoverBalance = (bill) => {
  if (bill?.handoverBalance != null && !Number.isNaN(Number(bill.handoverBalance))) {
    return Number(bill.handoverBalance);
  }
  const stored = getStoredLastHandover(bill);
  if (stored != null) return stored;
  return getErpBalance(bill);
};

export const buildAssignmentDetails = (bills = []) =>
  bills.map((bill) => ({
    billId: bill.id,
    erpBalance: getErpBalance(bill),
    handoverBalance: getHandoverBalance(bill),
    ...(bill.handoverNote ? { adjustmentNote: bill.handoverNote } : {}),
  }));

export const assignmentDetailsByBillId = (assignmentDetails = []) => {
  const map = {};
  assignmentDetails.forEach((detail) => {
    if (detail?.billId) map[detail.billId] = detail;
  });
  return map;
};

export const mergeHandoverOntoBills = (bills = [], assignmentDetails = []) => {
  const byId = assignmentDetailsByBillId(assignmentDetails);
  return bills.map((bill) => {
    const detail = byId[bill.id];
    const erpBalance =
      detail?.erpBalance != null ? Number(detail.erpBalance) : getErpBalance(bill);
    const handoverBalance =
      detail?.handoverBalance != null
        ? Number(detail.handoverBalance)
        : getDefaultHandoverBalance(bill);
    return {
      ...bill,
      erpBalance,
      handoverBalance,
      displayBalance: handoverBalance,
    };
  });
};

export const getBundleHandoverTotal = (assignmentDetails = []) =>
  assignmentDetails.reduce((sum, d) => sum + Number(d?.handoverBalance ?? 0), 0);

/** Bills included in a new bundle (attached, not with-party). */
export const getBillsForBundleCreate = (addedBills = [], withPartyBillIds = []) =>
  addedBills.filter((b) => !withPartyBillIds.includes(b.id));

export const canCreateBundle = (addedBills = [], withPartyBillIds = []) => {
  const bundleBills = getBillsForBundleCreate(addedBills, withPartyBillIds);
  const hasWithParty = withPartyBillIds.length > 0;
  const hasBundleBills = bundleBills.length > 0;
  const handoverTotal = bundleBills.reduce((s, b) => s + getHandoverBalance(b), 0);
  return {
    hasBundleBills,
    hasWithParty,
    canSubmit: hasWithParty || (hasBundleBills && handoverTotal > 0),
    bundleBills,
    handoverTotal,
  };
};

export const attachBillWithHandover = (
  bill,
  accountsNotes = '',
  handoverBalanceOverride,
) => {
  const erpBalance = getErpBalance(bill);
  const handoverBalance =
    handoverBalanceOverride != null && !Number.isNaN(Number(handoverBalanceOverride))
      ? Number(handoverBalanceOverride)
      : getDefaultHandoverBalance(bill);
  return {
    ...bill,
    ...(accountsNotes ? { accountsNotes } : {}),
    erpBalance,
    handoverBalance,
  };
};

export const parseHandoverInput = (value, fallback = 0) => {
  const parsed = parseInt(String(value).replace(/,/g, ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/** Amount shown on bundle print / MR-facing surfaces. */
export const getPrintBalance = (item, isBundle = false) => {
  if (!isBundle) return getErpBalance(item);
  return item?.handoverBalance != null
    ? Number(item.handoverBalance)
    : getErpBalance(item);
};

/** Bundle print slips omit lines with zero handover (combined-slip placeholders). */
export const filterBillsForBundlePrint = (bills = []) =>
  bills.filter((bill) => getPrintBalance(bill, true) !== 0);
