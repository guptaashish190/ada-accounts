export default {
  toasterId: 'toaster',
  firebase: {
    supplyReportStatus: {
      COMPLETED: 'Completed',
      DISPATCHED: 'Dispatched',
      TOACCOUNTS: 'To Accounts',
    },
    billBundleFlowStatus: {
      CREATED: 'CREATED',
      HANDOVER: 'HANDOVER',
      RECEIVED: 'RECEIVED',
    },
    billFlowTypes: {
      ORDER_CREATED: 'Order Created',
      BILL_CREATED: 'Bill Created',
      ORDER_PACKED: 'Order Packed',
      MODIFY_ORDER_REQUEST: 'MR Modify Request',
      BILL_MODIFIED: 'Bill Modified',
      DISPATCH_REPORT: 'Dispatched',
      DISPATCH_RECEIVED: 'Dispatch Received',
      DELIVERED: 'Delivered',
    },
  },
  newReceiptCounters: {
    CASHRECEIPTS: {
      name: 'CASHRECEIPTS',
      prefix: 'CR',
    },
    SUPPLYREPORTS: {
      name: 'SUPPLYREPORTS',
      prefix: 'SR',
    },
    BUNDLES: {
      name: 'BUNDLES',
      prefix: 'SR',
    },
    CHEQUES: {
      name: 'CHEQUES',
      prefix: 'CH',
    },
  },
};
