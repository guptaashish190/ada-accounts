/**
 * Snapshot / unit tests for the printer format generator functions.
 *
 * Both generators are pure functions: given an input object they return a
 * deterministic array of print command objects.
 */

jest.mock('lodash', () => {
  const actual = jest.requireActual('lodash');
  return actual;
});

// Mock globalUtils so generators don't need Firebase at test time.
jest.mock('../../renderer/services/globalUtils', () => ({
  __esModule: true,
  default: {
    getCurrencyFormat: (n) => (n == null ? '--' : `₹${n}`),
    dateDifferenceInDays: jest.fn(),
  },
}));

const cashReceiptFormatGenerator = require('../../renderer/common/printerDataGenerator/cashReceiptFormatGenerator').default;
const supplyReportFormatGenerator = require('../../renderer/common/printerDataGenerator/supplyReportFormatGenerator').default;

// ─── Cash Receipt ─────────────────────────────────────────────────────────────

const CASH_RECEIPT_DATA = {
  receiptNumber: 'CR-000001',
  user: 'Ashish Gupta',
  time: '10:30 AM',
  createdBy: 'admin',
  total: 1500,
  items: [
    {
      party: { name: 'Test Party', area: 'Gandhi Nagar' },
      amount: 1500,
    },
  ],
};

describe('cashReceiptFormatGenerator', () => {
  let commands;

  beforeEach(() => {
    commands = cashReceiptFormatGenerator(CASH_RECEIPT_DATA);
  });

  test('returns an array of commands', () => {
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
  });

  test('first command is the "Cash Receipt" title', () => {
    const title = commands.find((c) => c.type === 'text' && c.value === 'Cash Receipt');
    expect(title).toBeDefined();
    expect(title.style.textAlign).toBe('center');
  });

  test('contains the receipt number', () => {
    const receiptNumCmd = commands.find(
      (c) => c.type === 'text' && c.value === CASH_RECEIPT_DATA.receiptNumber,
    );
    expect(receiptNumCmd).toBeDefined();
  });

  test('contains a barcode command for the receipt number', () => {
    const barcode = commands.find((c) => c.type === 'barCode');
    expect(barcode).toBeDefined();
    expect(barcode.value).toBe(CASH_RECEIPT_DATA.receiptNumber);
  });

  test('contains the user name', () => {
    const userCmd = commands.find(
      (c) => c.type === 'text' && c.value.includes(CASH_RECEIPT_DATA.user),
    );
    expect(userCmd).toBeDefined();
  });

  test('includes total in a command', () => {
    const totalCmd = commands.find(
      (c) => c.type === 'text' && c.value.includes('Total'),
    );
    expect(totalCmd).toBeDefined();
    expect(totalCmd.value).toContain('₹1500');
  });

  test('includes item party details', () => {
    const partyCmd = commands.find(
      (c) =>
        c.type === 'text' &&
        c.value.toLowerCase().includes('test party'),
    );
    expect(partyCmd).toBeDefined();
  });

  test('matches snapshot', () => {
    expect(commands).toMatchSnapshot();
  });
});

// ─── Supply Report ────────────────────────────────────────────────────────────

const SUPPLY_REPORT_DATA = {
  receiptNumber: 'SR-000001',
  supplyman: 'Ramesh Kumar',
  dispatchTime: '9:00 AM',
  numCases: 3,
  numPackets: 5,
  numPolybags: 2,
  dispatchNotes: 'Handle carefully',
  accountDispatchNotes: 'Collect balance',
  bills: [
    {
      party: { name: 'ABC Medical', area: 'Connaught Place' },
      billNumber: 'B-1001',
      balance: 2500,
      bags: [
        { bagType: 'Case', quantity: 1 },
        { bagType: 'Packet', quantity: 2 },
      ],
    },
  ],
  oldBills: [],
};

describe('supplyReportFormatGenerator', () => {
  let commands;

  beforeEach(() => {
    commands = supplyReportFormatGenerator(SUPPLY_REPORT_DATA, false);
  });

  test('returns an array of commands', () => {
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
  });

  test('first command contains "Supply Report" title', () => {
    const title = commands.find(
      (c) => c.type === 'text' && c.value === 'Supply Report',
    );
    expect(title).toBeDefined();
  });

  test('contains the receipt number', () => {
    const receiptCmd = commands.find(
      (c) => c.type === 'text' && c.value === SUPPLY_REPORT_DATA.receiptNumber,
    );
    expect(receiptCmd).toBeDefined();
  });

  test('contains the supplyman name', () => {
    const supplymanCmd = commands.find(
      (c) => c.type === 'text' && c.value.includes(SUPPLY_REPORT_DATA.supplyman),
    );
    expect(supplymanCmd).toBeDefined();
  });

  test('contains cases / packets / polybags summary', () => {
    const summaryCmd = commands.find(
      (c) =>
        c.type === 'text' &&
        c.value.includes('Cases') &&
        c.value.includes('Polybags'),
    );
    expect(summaryCmd).toBeDefined();
  });

  test('includes a barcode command', () => {
    const barcode = commands.find((c) => c.type === 'barCode');
    expect(barcode).toBeDefined();
    expect(barcode.value).toBe(SUPPLY_REPORT_DATA.receiptNumber);
  });

  test('contains bill party details', () => {
    const partyCmd = commands.find(
      (c) =>
        c.type === 'text' &&
        c.value.toLowerCase().includes('abc medical'),
    );
    expect(partyCmd).toBeDefined();
  });

  test('when isBundle=true, title is "Bundle" not "Supply Report"', () => {
    const bundleCommands = supplyReportFormatGenerator(SUPPLY_REPORT_DATA, true);
    const title = bundleCommands.find(
      (c) => c.type === 'text' && c.value === 'Bundle',
    );
    expect(title).toBeDefined();
  });

  test('when isBundle=true, prints handoverBalance not erp balance', () => {
    const bundleData = {
      ...SUPPLY_REPORT_DATA,
      bills: [],
      oldBills: [
        {
          party: { name: 'ABC Medical', area: 'CP' },
          billNumber: 'B-1001',
          balance: 5000,
          handoverBalance: 4950,
        },
      ],
    };
    const bundleCommands = supplyReportFormatGenerator(bundleData, true);
    const billLine = bundleCommands.find(
      (c) => c.type === 'text' && String(c.value).includes('B-1001'),
    );
    expect(billLine.value).toContain('₹4950');
    expect(billLine.value).not.toContain('₹5000');
  });

  test('omits dispatch and account note rows when values are empty', () => {
    const commands = supplyReportFormatGenerator(
      {
        ...SUPPLY_REPORT_DATA,
        dispatchNotes: undefined,
        accountDispatchNotes: '',
      },
      false,
    );
    expect(
      commands.some(
        (c) => c.type === 'text' && String(c.value).startsWith('Dispatch Notes:'),
      ),
    ).toBe(false);
    expect(
      commands.some(
        (c) => c.type === 'text' && String(c.value).startsWith('Account Notes:'),
      ),
    ).toBe(false);
  });

  test('when bundle is provided on supply report, appends bundle section', () => {
    const combinedCommands = supplyReportFormatGenerator(
      {
        ...SUPPLY_REPORT_DATA,
        bundle: {
          receiptNumber: 'BD-000042',
          bills: [
            {
              partyId: 'p2',
              party: { name: 'XYZ Pharma', area: 'Karol Bagh' },
              billNumber: 'B-2001',
              balance: 5000,
              handoverBalance: 4800,
            },
          ],
        },
        includeBarcode: false,
      },
      false,
    );

    const bundleReceipt = combinedCommands.find(
      (c) => c.type === 'text' && c.value === 'BD-000042',
    );
    const bundleBillLine = combinedCommands.find(
      (c) => c.type === 'text' && String(c.value).includes('B-2001'),
    );

    const oldBillsLabel = combinedCommands.find(
      (c) => c.type === 'text' && c.value === 'Old bills in hand',
    );

    expect(bundleReceipt).toBeDefined();
    expect(bundleReceipt.style.fontSize).toBe('14px');
    expect(oldBillsLabel).toBeDefined();
    expect(oldBillsLabel.style.fontSize).toBe('12px');
    expect(
      combinedCommands.some(
        (c) => c.type === 'text' && c.value === 'Bundle',
      ),
    ).toBe(false);
    expect(
      combinedCommands.some(
        (c) =>
          c.type === 'text' &&
          String(c.value).startsWith('Assigned to:'),
      ),
    ).toBe(false);
    expect(bundleBillLine.value).toContain('₹4800');
    expect(
      combinedCommands.some((c) => c.type === 'barCode'),
    ).toBe(false);
  });

  test('when includeBarcode=false, omits barcode command', () => {
    const noBarcodeCommands = supplyReportFormatGenerator(
      { ...SUPPLY_REPORT_DATA, includeBarcode: false },
      false,
    );
    expect(
      noBarcodeCommands.some((c) => c.type === 'barCode'),
    ).toBe(false);
  });

  test('when isBundle=true, omits bills with zero handover from print', () => {
    const bundleData = {
      ...SUPPLY_REPORT_DATA,
      bills: [],
      oldBills: [
        {
          partyId: 'p1',
          party: { name: 'ABC Medical', area: 'CP' },
          billNumber: 'B-0001',
          balance: 500,
          handoverBalance: 0,
        },
        {
          partyId: 'p1',
          party: { name: 'ABC Medical', area: 'CP' },
          billNumber: 'B-0002',
          balance: 500,
          handoverBalance: 2000,
        },
      ],
    };
    const bundleCommands = supplyReportFormatGenerator(bundleData, true);
    expect(
      bundleCommands.some(
        (c) => c.type === 'text' && String(c.value).includes('B-0001'),
      ),
    ).toBe(false);
    expect(
      bundleCommands.some(
        (c) => c.type === 'text' && String(c.value).includes('B-0002'),
      ),
    ).toBe(true);
  });

  test('matches snapshot (isBundle=false)', () => {
    expect(commands).toMatchSnapshot();
  });
});
