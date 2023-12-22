import constants from '../constants';

export default [
  {
    name: 'Supply Report',
    key: 'tab-supply-report',
    submenu: [
      {
        name: 'All Supply Reports',
        route: '/',
        key: 'tab-allSupplyReports',
        allowJob: [
          constants.firebaseIds.JOBS.DISPATCH,
          constants.firebaseIds.JOBS.CASHIER,
        ],
      },
      {
        name: 'Create Supply Report',
        route: '/createSupplyReport',
        key: 'tab-create-supply-report',
        allowJob: [constants.firebaseIds.JOBS.DISPATCH],
      },
      {
        name: 'Pending Supply Reports',
        route: '/pendingSupplyReports',
        key: 'tab-pendingSupplyReports',
        allowJob: [constants.firebaseIds.JOBS.CASHIER],
      },
      {
        name: 'Receive Supply Reports',
        route: '/receiveSupplyReports',
        key: 'tab-receiveSupplyReports',
        allowJob: [constants.firebaseIds.JOBS.CASHIER],
      },
    ],
  },
  {
    name: 'Search Bills',
    route: '/searchBills',
    key: 'tab-searchBills',
  },
  {
    name: 'Scheduled',
    route: '/scheduled',
    key: 'tab-scheduled',
  },
  {
    name: 'Payments',
    route: '/upi',
    key: 'tab-upi',
    allowJob: [constants.firebaseIds.JOBS.CASHIER],
  },

  {
    name: 'Receipts',
    route: '/receipts',
    key: 'tab-paymentreceipts',
    submenu: [
      {
        name: 'Payments',
        route: '/paymentReceipts',
        key: 'tab-payments',
      },
      {
        name: 'Vouchers',
        route: '/vouchers',
        key: 'tab-vouchers',
      },
    ],
    allowJob: [constants.firebaseIds.JOBS.CASHIER],
  },
  {
    name: 'Cheques',
    route: '/chequesList',
    key: 'tab-chequesList',
    allowJob: [constants.firebaseIds.JOBS.CASHIER],
  },
  {
    name: 'Receive User',
    route: '/receivePendingUser',
    key: 'tab-receivependinuser',
    allowJob: [constants.firebaseIds.JOBS.CASHIER],
  },
  {
    name: 'Bundles',
    key: 'tab-bundles',
    allowJob: [constants.firebaseIds.JOBS.CASHIER],
    submenu: [
      {
        name: 'All Bundles',
        route: '/bundles',
        key: 'tab-bundles',
      },
      {
        name: 'Create Bill Bundle',
        route: '/assignBills',
        key: 'tab-assignbills',
      },
    ],
  },
  {
    name: 'Settings',
    key: 'tab-settings',
    submenu: [
      {
        name: 'Parties',
        route: '/partyListSettings',
        key: 'tab-settings',
      },
      {
        name: 'Printer',
        route: '/printerSettings',
        key: 'tab-settings-printers',
      },
      {
        name: 'Routes',
        route: '/routeSettings',
        key: 'tab-settings-route',
        allowJob: [],
      },
    ],
  },
  {
    name: 'Credit Notes',

    key: 'tab-creditNotes',
    allowJob: [constants.firebaseIds.JOBS.CASHIER],
    submenu: [
      {
        name: 'Credit Notes',
        route: '/creditNotes',
        key: 'tab-creditNotes',
      },
      {
        name: 'Create C/N',
        route: '/createCreditNotes',
        key: 'tab-createcreditNotes',
      },
    ],
  },
];
