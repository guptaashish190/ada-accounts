const {
  parseRouteCell,
  parseRouteColumns,
  parseSheetRows,
  prepareRouteImport,
  buildRouteExportRows,
  emptyWeek,
} = require('../../renderer/screens/settings/routes/routeImportAlgo');

const party = (id, name) => ({ id, name });

describe('parseRouteCell', () => {
  test('maps truncated spellings onto the canonical route and weekday', () => {
    expect(parseRouteCell('WEDNESDAY SATYE')).toMatchObject({
      dayIndex: 2,
      day: 'Wednesday',
      routeName: 'SATYENDAR',
    });
    expect(parseRouteCell('THURSDAY 1 SATE').routeName).toBe('SATYENDAR');
    expect(parseRouteCell('THURSDAY 2 SATY').routeName).toBe('SATYENDAR');
    expect(parseRouteCell('SATURDAY 1 HIMA').routeName).toBe('HIMANSHU');
    expect(parseRouteCell('SATURDAY 2 ARVI').routeName).toBe('ARVIND');
    expect(parseRouteCell('FRIDAY 1 VISH').routeName).toBe('1 VISHAL');
    expect(parseRouteCell('FRIDAY ARVIND 1').routeName).toBe('ARVIND');
    expect(parseRouteCell('WEDNESDAY GRISH').routeName).toBe('GIRISH');
    expect(parseRouteCell('TUESDAY RAVINDR').routeName).toBe('RAVINDRA');
  });

  test('blank and unknown routes are not assignments', () => {
    expect(parseRouteCell('  ').blank).toBe(true);
    expect(parseRouteCell('WEDNESDAY SOMEONE').error).toBe('unknown-route');
    expect(parseRouteCell('FUNDAY ABHAY').error).toBe('unknown-weekday');
  });
});

describe('prepareRouteImport', () => {
  const sheet = [
    { rowNumber: 2, partyName: 'AAYUSH PHARMACY (4) BANGLA CHAURAHA', routeText: 'WEDNESDAY SATYENDAR' },
    { rowNumber: 3, partyName: 'AKHILESH MEDICAL STORE (2) JANKI NAGAR', routeText: 'TUESDAY RAVINDR' },
    { rowNumber: 4, partyName: 'YASHI PHARMA (R) NAUGARH', routeText: '' },
    { rowNumber: 5, partyName: 'MISSING STORE', routeText: 'MONDAY ABHAY' },
    { rowNumber: 6, partyName: 'AAYUSH PHARMACY (4) BANGLA CHAURAHA', routeText: 'FRIDAY SATYE' },
  ];

  const parties = [
    party('p-aayush', 'AAYUSH PHARMACY (4) BANGLA CHAURAHA'),
    party('p-akhilesh', '  akhilesh   medical store (2) janki nagar '),
    party('p-yashi', 'YASHI PHARMA (R) NAUGARH'),
    party('p-stay', 'STAYS PUT'),
  ];

  const existingRoutes = [
    {
      id: 'route-sat',
      name: 'Satyendar',
      route: [
        { day: 'Monday', parties: ['p-aayush', 'p-stay'], fileNumber: 'F1' },
        { day: 'Tuesday', parties: [], fileNumber: '' },
        { day: 'Wednesday', parties: [], fileNumber: 'W' },
        { day: 'Thursday', parties: [], fileNumber: '' },
        { day: 'Friday', parties: [], fileNumber: '' },
        { day: 'Saturday', parties: [], fileNumber: '' },
        { day: 'Sunday', parties: [], fileNumber: '' },
      ],
    },
    {
      id: 'route-abhay',
      name: 'ABHAY',
      route: emptyWeek().map((day, index) =>
        index === 0 ? { ...day, parties: ['p-yashi'] } : day,
      ),
    },
  ];

  test('places matched parties, keeps blank rows, and does not write yet', () => {
    const plan = prepareRouteImport({
      sheetRows: sheet,
      parties,
      existingRoutes,
    });

    expect(plan.stats.blankRoutes).toBe(1);
    expect(plan.stats.partyNotFound).toBe(1);
    expect(plan.stats.duplicatePartyRows).toBe(1);
    expect(plan.stats.assignedParties).toBe(2);
    expect(plan.stats.routesToCreate).toBe(1);
    expect(plan.stats.routesToUpdate).toBe(1);

    const satyendar = plan.writes.updates.find((route) => route.id === 'route-sat');
    expect(satyendar.route[0].parties).toEqual(['p-stay']);
    expect(satyendar.route[0].fileNumber).toBe('F1');
    expect(satyendar.route[4].parties).toEqual(['p-aayush']);
    expect(satyendar.route[2].fileNumber).toBe('W');

    expect(plan.writes.creates).toEqual([
      expect.objectContaining({
        name: 'RAVINDRA',
      }),
    ]);
    expect(plan.writes.creates[0].route[1].parties).toEqual(['p-akhilesh']);
    expect(plan.writes.creates[0].route).toHaveLength(7);

    const abhay = plan.writes.updates.find((route) => route.id === 'route-abhay');
    expect(abhay).toBeUndefined();
    expect(plan.writes.updates.some((route) => route.id === 'route-abhay')).toBe(false);
  });

  test('a party already on the target day produces no write', () => {
    const plan = prepareRouteImport({
      sheetRows: [
        { rowNumber: 2, partyName: 'STAYS PUT', routeText: 'MONDAY SATYENDAR' },
      ],
      parties,
      existingRoutes,
    });
    expect(plan.writes.updates).toHaveLength(0);
    expect(plan.writes.creates).toHaveLength(0);
  });

  test('parseSheetRows reads the route list headers', () => {
    const parsed = parseSheetRows([
      { 'Party Name': 'SHOP', ROUTE: 'MONDAY ABHAY' },
    ]);
    expect(parsed.error).toBeNull();
    expect(parsed.rows[0]).toMatchObject({
      rowNumber: 2,
      partyName: 'SHOP',
      routeText: 'MONDAY ABHAY',
    });
  });

  test('reads Party Name, Route Name, and Day, and keeps a renamed route', () => {
    const parsed = parseSheetRows([
      { 'Party Name': 'SHOP', 'Route Name': 'ARVIND 1', Day: 'Fri' },
      { 'Party Name': 'OTHER', 'Route Name': 'City Route', Day: 'Monday' },
    ]);
    expect(parsed.rows[0]).toMatchObject({
      partyName: 'SHOP',
      routeName: 'ARVIND 1',
      day: 'Fri',
    });
    expect(parseRouteColumns('ARVIND 1', 'Fri')).toMatchObject({
      dayIndex: 4,
      day: 'Friday',
      routeName: 'ARVIND',
    });

    const plan = prepareRouteImport({
      sheetRows: parsed.rows,
      parties: [party('p-shop', 'SHOP'), party('p-other', 'OTHER')],
      existingRoutes: [],
    });
    const names = plan.writes.creates.map((route) => route.name).sort();
    expect(names).toEqual(['ARVIND', 'City Route']);
    expect(plan.writes.creates.find((route) => route.name === 'ARVIND').route[4].parties).toEqual(['p-shop']);
    expect(plan.writes.creates.find((route) => route.name === 'City Route').route[0].parties).toEqual(['p-other']);
  });

  test('exports one row per party on a route day', () => {
    const rows = buildRouteExportRows(
      {
        'p-aayush': { name: 'AAYUSH PHARMACY' },
        'p-stay': { name: 'STAYS PUT' },
        'p-yashi': { name: 'YASHI PHARMA' },
      },
      existingRoutes,
    );
    expect(rows).toEqual([
      { 'Party Name': 'YASHI PHARMA', 'Route Name': 'ABHAY', Day: 'Monday' },
      { 'Party Name': 'AAYUSH PHARMACY', 'Route Name': 'Satyendar', Day: 'Monday' },
      { 'Party Name': 'STAYS PUT', 'Route Name': 'Satyendar', Day: 'Monday' },
    ]);
  });
});
