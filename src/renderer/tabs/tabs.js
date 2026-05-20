import constants from '../constants';

export default [
  {
    name: 'Dashboard',
    key: 'tab-dashboard',
    allowJob: [constants.firebaseIds.JOBS.CASHIER],
    submenu: [
      {
        name: 'Cashier',
        route: '/cashierDashboard',
        key: 'tab-dashboard-cashier',
        allowJob: [constants.firebaseIds.JOBS.CASHIER],
      },
      {
        name: 'Manager',
        route: '/managerDashboard',
        key: 'tab-dashboard-manager',
        allowJob: [],
      },
    ],
  },
  {
    name: 'Supply',
    key: 'tab-supply',
    submenu: [
      {
        name: 'Supply Reports',
        route: '/',
        key: 'tab-supply-all',
        allowJob: [
          constants.firebaseIds.JOBS.DISPATCH,
          constants.firebaseIds.JOBS.CASHIER,
        ],
      },
      {
        name: 'Verify',
        route: '/pendingSupplyReports',
        key: 'tab-supply-verify',
        allowJob: [constants.firebaseIds.JOBS.CASHIER],
      },
      {
        name: 'Receive',
        route: '/receiveSupplyReports',
        key: 'tab-supply-receive',
        allowJob: [constants.firebaseIds.JOBS.CASHIER],
      },
      {
        name: 'Bundles',
        route: '/bundles',
        key: 'tab-supply-bundles-all',
        allowJob: [constants.firebaseIds.JOBS.CASHIER],
      },
    ],
  },
  {
    name: 'Transactions',
    key: 'tab-transactions',
    allowJob: [constants.firebaseIds.JOBS.CASHIER],
    submenu: [
      {
        name: 'Expense',
        route: '/vouchers',
        key: 'tab-transactions-expense',
      },
      {
        name: 'Cash Receipts',
        route: '/paymentReceipts',
        key: 'tab-transactions-cash-receipts',
      },
      {
        name: 'UPI',
        route: '/upi',
        key: 'tab-transactions-upi',
      },
      {
        name: 'Cheques',
        route: '/chequesList',
        key: 'tab-transactions-cheques',
        allowJob: [constants.firebaseIds.JOBS.CASHIER],
      },
    ],
  },
  {
    name: 'Bills',
    key: 'tab-bills',
    submenu: [
      {
        name: 'All Bills',
        route: '/searchBills',
        key: 'tab-bills-all',
      },
      {
        name: 'Pending Bills',
        route: '/pendingBillsToday',
        key: 'tab-bills-pending',
      },
    ],
  },
  {
    name: 'Reports',
    key: 'tab-reports',
    submenu: [
      {
        name: 'Supply',
        route: '/daySupplyReportPrint',
        key: 'tab-reports-supply',
      },
      {
        name: 'Expense',
        route: '/expenseReport',
        key: 'tab-reports-expense',
      },
      {
        name: 'Collection',
        route: '/collectionReport',
        key: 'tab-reports-collection',
      },
    ],
  },
  {
    name: 'Settings',
    key: 'tab-settings',
    submenu: [
      {
        name: 'Users',
        route: '/usersManagement',
        key: 'tab-settings-users',
        allowJob: [],
      },
      {
        name: 'Products',
        route: '/products',
        key: 'tab-settings-products',
      },
      {
        name: 'Companies',
        route: '/companiesManagement',
        key: 'tab-settings-companies',
        allowJob: [],
      },
      {
        name: 'Routes',
        route: '/routeSettings',
        key: 'tab-settings-routes',
        allowJob: [],
      },
      {
        name: 'Parties',
        route: '/partyListSettings',
        key: 'tab-settings-parties',
      },
      {
        name: 'Printer',
        route: '/printerSettings',
        key: 'tab-settings-printer',
      },
    ],
  },
];
