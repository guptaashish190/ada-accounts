export default {
  toasterId: 'toaster',
  printConstants: {
    PRINT_CASHRECEIPT: 'PRINT_CASH_RECEIPT',
  },
  firebase: {
    supplyReportStatus: {
      COMPLETED: 'Completed',
      DISPATCHED: 'Dispatched',
      TOACCOUNTS: 'To Accounts',
      CANCELLED: 'CANCELLED',
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
    CREDITNOTE: {
      name: 'CREDITNOTE',
      prefix: 'CN',
    },
  },
  colors: {
    success: '#66bb6a',
    error: '#f44336',
    warning: '#ffa726',
  },

  firebaseIds: {
    JOBS: {
      DISPATCH: 'BiT2WpxL7rBnjovrxP54',
      CASHIER: '3PyLZYPjuyfGwY3LJTY9',
    },
  },
};
