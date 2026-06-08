export default {
  toasterId: 'toaster',
  printConstants: {
    PRINT_CASHRECEIPT: 'PRINT_CASH_RECEIPT',
  },
  windowConstants: {
    MR_DETAIL: 'MR_DETAIL',
    VIEW_SUPPLY_REPORT: 'VIEW_SUPPLY_REPORT',
    RECEIVE_SUPPLY_REPORT: 'RECEIVE_SUPPLY_REPORT',
    CREATE_SUPPLY_REPORT: 'CREATE_SUPPLY_REPORT',
    VIEW_VOUCHER: 'VIEW_VOUCHER',
    ASSIGN_BILLS: 'ASSIGN_BILLS',
    VIEW_BUNDLE: 'VIEW_BUNDLE',
  },
  paymentOkBuffer: 2,
  paymentTermsListItems: ['Monthly', 'Weekly', 'Cash', 'Bill to Bill'],
  firebase: {
    supplyReportStatus: {
      COMPLETED: 'Completed',
      DISPATCHED: 'Dispatched',
      TOACCOUNTS: 'To Accounts',
      CANCELLED: 'CANCELLED',
      DELIVERED: 'Delivered',
    },
    billBundleFlowStatus: {
      CREATED: 'CREATED',
      HANDOVER: 'HANDOVER',
      COMPLETED: 'Completed',
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
      RECEIVED_BILL: 'Received Bill',
      GOODS_RETURNED: 'Goods Returned',
      GOODS_RETURN_RECD: 'Goods Return Recd',
      BILL_WITH_PARTY: 'Bill With Party',
      SUPPLY_REPORT_CANCELLED: 'Supply Report Cancelled',
      MARG_DATA: 'Marg Data',
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
      prefix: 'BD',
    },
    CHEQUES: {
      name: 'CHEQUES',
      prefix: 'CH',
    },
    CREDITNOTE: {
      name: 'CREDITNOTE',
      prefix: 'CN',
    },
    VOUCHERS: {
      name: 'VOUCHERS',
      prefix: 'VR',
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
      MR: 'cAf2yrduIKDf7jLQ8KWu',
      SUPPLY: 'vh8bGmg9haGmpNs4a9vw',
    },
  },
};
