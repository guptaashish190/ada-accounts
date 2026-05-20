import {
  FluentProvider,
  webLightTheme,
  Button,
} from '@fluentui/react-components';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import constants from '../constants';
import '../firebaseInit';
import AllUsersContext from '../contexts/allUsersContext';
import CompanyProvider from '../contexts/companyContext';
import PrintCashReceipt from './printCashReceipt/printCasheReceipt';
import MrDetailPanel from './mrDetailPanel/mrDetailPanel';
import ViewSupplyReportScreen from '../screens/viewSupplyReport/viewSupplyReport';
import ReceiveSupplyReportScreen from '../screens/receiveSupplyReport/receiveSupplyReportList';
import ReceiveSRScreen from '../screens/receiveSupplyReport/receiveSRScreen/receiveSRScreen';
import CreatePaymentReceiptDialog from '../screens/paymentReceipts/createPaymentReceiptDialog/createPaymentReceiptDialog';
import CreateSupplyReportScreen from '../screens/createSupplyReport/createSupplyReport';
import ViewVoucherScreen from '../screens/vouchers/viewVoucherScreen';
import AssignBillScreen from '../screens/assignBills/assignBillsScreen';

export default function App({ args }) {
  const isPrint = args.type === constants.printConstants.PRINT_CASHRECEIPT;

  useEffect(() => {
    const titlesByType = {
      [constants.windowConstants.MR_DETAIL]: 'MR Detail',
      [constants.windowConstants.VIEW_SUPPLY_REPORT]: 'Supply Report',
      [constants.windowConstants.RECEIVE_SUPPLY_REPORT]: 'Receive Supply Report',
      [constants.windowConstants.CREATE_SUPPLY_REPORT]: 'Create Supply Report',
      [constants.windowConstants.VIEW_VOUCHER]: 'View Voucher',
      [constants.windowConstants.ASSIGN_BILLS]: 'Assign Bills',
      [constants.printConstants.PRINT_CASHRECEIPT]: 'Print Cash Receipt',
    };
    document.title = titlesByType[args.type] || 'Child Window';
  }, [args.type]);

  useEffect(() => {
    if (isPrint) {
      window.print();
    }
  }, []);

  if (args.type === constants.windowConstants.MR_DETAIL) {
    return (
      <FluentProvider theme={webLightTheme}>
        <MrDetailPanel data={args.data} />
      </FluentProvider>
    );
  }

  if (args.type === constants.windowConstants.VIEW_SUPPLY_REPORT) {
    const reportKey =
      args.data?.prefillSupplyReport?.id ?? args.data?.supplyReportId ?? 'new';
    return (
      <FluentProvider theme={webLightTheme}>
        <CompanyProvider>
          <AllUsersContext>
            <MemoryRouter
              key={reportKey}
              initialEntries={[
                {
                  pathname: '/viewSupplyReport',
                  state: {
                    prefillSupplyReport: args.data?.prefillSupplyReport,
                    supplyReportId: args.data?.supplyReportId,
                  },
                },
              ]}
            >
              <ViewSupplyReportScreen />
            </MemoryRouter>
          </AllUsersContext>
        </CompanyProvider>
      </FluentProvider>
    );
    
  }

  if (args.type === constants.windowConstants.RECEIVE_SUPPLY_REPORT) {
    const reportKey = args.data?.supplyReport?.id ?? 'receive-sr';
    return (
      <FluentProvider theme={webLightTheme}>
        <CompanyProvider>
          <AllUsersContext>
            <MemoryRouter
              key={reportKey}
              initialEntries={[
                {
                  pathname: '/receiveSRScreen',
                  state: {
                    supplyReport: args.data?.supplyReport,
                    isBundle: args.data?.isBundle ?? false,
                  },
                },
              ]}
            >
              <Routes>
                <Route
                  path="/receiveSupplyReports"
                  element={<ReceiveSupplyReportScreen />}
                />
                <Route path="/receiveSRScreen" element={<ReceiveSRScreen />} />
                <Route
                  path="/createPaymentReceipts"
                  element={<CreatePaymentReceiptDialog />}
                />
              </Routes>
            </MemoryRouter>
          </AllUsersContext>
        </CompanyProvider>
      </FluentProvider>
    );
  }

  if (args.type === constants.windowConstants.CREATE_SUPPLY_REPORT) {
    return (
      <FluentProvider theme={webLightTheme}>
        <CompanyProvider>
          <AllUsersContext>
            <MemoryRouter initialEntries={['/createSupplyReport']}>
              <Routes>
                <Route
                  path="/createSupplyReport"
                  element={<CreateSupplyReportScreen />}
                />
              </Routes>
            </MemoryRouter>
          </AllUsersContext>
        </CompanyProvider>
      </FluentProvider>
    );
  }

  if (args.type === constants.windowConstants.VIEW_VOUCHER) {
    const voucherKey = args.data?.voucherData?.id ?? 'view-voucher';
    return (
      <FluentProvider theme={webLightTheme}>
        <CompanyProvider>
          <AllUsersContext>
            <MemoryRouter
              key={voucherKey}
              initialEntries={[
                {
                  pathname: '/viewVoucherScreen',
                  state: {
                    voucherData: args.data?.voucherData,
                  },
                },
              ]}
            >
              <Routes>
                <Route path="/viewVoucherScreen" element={<ViewVoucherScreen />} />
              </Routes>
            </MemoryRouter>
          </AllUsersContext>
        </CompanyProvider>
      </FluentProvider>
    );
  }

  if (args.type === constants.windowConstants.ASSIGN_BILLS) {
    return (
      <FluentProvider theme={webLightTheme}>
        <CompanyProvider>
          <AllUsersContext>
            <MemoryRouter initialEntries={['/assignBills']}>
              <Routes>
                <Route path="/assignBills" element={<AssignBillScreen />} />
              </Routes>
            </MemoryRouter>
          </AllUsersContext>
        </CompanyProvider>
      </FluentProvider>
    );
  }

  if (isPrint) {
    return (
      <>
        <PrintCashReceipt data={args.printData} />

        <Button className="print-button" onClick={() => window.print()}>
          Print
        </Button>
      </>
    );
  }

  return <div>Type not found</div>;
}
