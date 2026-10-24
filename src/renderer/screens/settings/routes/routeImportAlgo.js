/**
 * Plan party-to-route assignments from Excel, and build the export rows.
 * This module does not read or write Firestore.
 *
 * Sheet columns: Party Name, Route Name, Day.
 * A legacy sheet with Party Name and ROUTE ("WEDNESDAY SATYENDAR") still imports.
 *
 * Algorithm:
 * 1. Match Party Name to an existing party. Parties are not created.
 * 2. Read Day as the weekday. Collapse known short route spellings
 *    (SATYE to SATYENDAR, ARVIND 1 to ARVIND). Any other route name is kept.
 * 3. Reuse an mr_routes document with that name, or create one with 7 days.
 * 4. Put the party id on that weekday and remove it from every other day and route.
 * 5. A blank route name or day leaves that party's current assignment unchanged.
 * 6. A later row for the same party replaces an earlier one.
 */

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAY_INDEX = DAYS_OF_WEEK.reduce((map, day, index) => {
  map[day.toUpperCase()] = index;
  return map;
}, {});

const DAY_SHORT = {
  MON: 0,
  TUE: 1,
  TUES: 1,
  WED: 2,
  THU: 3,
  THUR: 3,
  THURS: 3,
  FRI: 4,
  SAT: 5,
  SUN: 6,
};

export const EXPORT_HEADERS = ['Party Name', 'Route Name', 'Day'];

/** Uppercase remainder of the ROUTE cell -> canonical mr_routes.name */
export const ROUTE_NAME_ALIASES = {
  SATYENDAR: 'SATYENDAR',
  SATYENDA: 'SATYENDAR',
  SATYEND: 'SATYENDAR',
  SATYEN: 'SATYENDAR',
  SATYE: 'SATYENDAR',
  SATY: 'SATYENDAR',
  SATE: 'SATYENDAR',
  '1 SATE': 'SATYENDAR',
  '2 SATY': 'SATYENDAR',
  HIMA: 'HIMANSHU',
  '1 HIMA': 'HIMANSHU',
  HIMANSHU: 'HIMANSHU',
  RAVINDRA: 'RAVINDRA',
  RAVINDR: 'RAVINDRA',
  RAVIND: 'RAVINDRA',
  RAVIN: 'RAVINDRA',
  GIRISH: 'GIRISH',
  GRISH: 'GIRISH',
  NITISH: 'NITISH',
  NITIS: 'NITISH',
  SATISH: 'SATISH',
  SATIS: 'SATISH',
  '1 VISHAL': '1 VISHAL',
  '1 VISH': '1 VISHAL',
  '2 ARVI': 'ARVIND',
  '2 ARVIND': 'ARVIND',
  ARVIND: 'ARVIND',
  'ARVIND 1': 'ARVIND',
  ABHAY: 'ABHAY',
  BAIJNATH: 'BAIJNATH',
  MUKUL: 'MUKUL',
  FAROOQUE: 'FAROOQUE',
  YOGESH: 'YOGESH',
  RISHAB: 'RISHAB',
};

export const emptyWeek = () =>
  DAYS_OF_WEEK.map((day) => ({
    day,
    parties: [],
    fileNumber: '',
  }));

export const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

const findColumn = (headers, candidates) => {
  const lower = headers.map((header) => normalizeKey(header));
  const matchIndex = candidates.findIndex((candidate) =>
    lower.includes(normalizeKey(candidate)),
  );
  if (matchIndex === -1) return null;
  return headers[lower.indexOf(normalizeKey(candidates[matchIndex]))];
};

export const parseSheetRows = (jsonRows) => {
  if (!Array.isArray(jsonRows) || jsonRows.length === 0) {
    return { rows: [], error: 'The sheet has no data rows.' };
  }

  const headers = Object.keys(jsonRows[0]);
  const partyColumn = findColumn(headers, ['Party Name', 'Party', 'Name']);
  const routeNameColumn = findColumn(headers, ['Route Name']);
  const dayColumn = findColumn(headers, ['Day', 'Weekday']);
  const legacyColumn = findColumn(headers, ['ROUTE', 'Route']);

  if (!partyColumn) {
    return { rows: [], error: 'The sheet needs a "Party Name" column.' };
  }

  if (routeNameColumn && dayColumn) {
    const rows = jsonRows.map((row, index) => ({
      rowNumber: index + 2,
      partyName: String(row[partyColumn] ?? '').trim(),
      routeName: String(row[routeNameColumn] ?? '').trim(),
      day: String(row[dayColumn] ?? '').trim(),
    }));
    return { rows, error: null };
  }

  if (legacyColumn) {
    const rows = jsonRows.map((row, index) => ({
      rowNumber: index + 2,
      partyName: String(row[partyColumn] ?? '').trim(),
      routeText: String(row[legacyColumn] ?? '').trim(),
    }));
    return { rows, error: null };
  }

  return {
    rows: [],
    error: 'The sheet needs "Party Name", "Route Name", and "Day" columns.',
  };
};

export const resolveDay = (dayText) => {
  const key = normalizeKey(dayText);
  if (!key) return { blank: true };
  const dayIndex = DAY_INDEX[key] ?? DAY_SHORT[key];
  if (dayIndex === undefined) {
    return { error: 'unknown-weekday', raw: key };
  }
  return { dayIndex, day: DAYS_OF_WEEK[dayIndex] };
};

export const resolveRouteName = (routeName) => {
  const key = normalizeKey(routeName);
  if (!key) return { blank: true };
  if (ROUTE_NAME_ALIASES[key]) return { routeName: ROUTE_NAME_ALIASES[key] };
  return { routeName: String(routeName).trim().replace(/\s+/g, ' ') };
};

export const parseRouteColumns = (routeName, dayText) => {
  const day = resolveDay(dayText);
  const route = resolveRouteName(routeName);
  if (day.blank || route.blank) return { blank: true };
  if (day.error) return { ...day, routeName: route.routeName };
  return {
    dayIndex: day.dayIndex,
    day: day.day,
    routeName: route.routeName,
  };
};

export const parseRouteCell = (routeText) => {
  const text = normalizeKey(routeText);
  if (!text) return { blank: true };

  const space = text.indexOf(' ');
  if (space === -1) {
    return { error: 'missing-route-name', raw: text };
  }

  const dayWord = text.slice(0, space);
  const remainder = text.slice(space + 1).trim();
  const dayIndex = DAY_INDEX[dayWord];
  if (dayIndex === undefined) {
    return { error: 'unknown-weekday', raw: text, dayWord };
  }

  const routeName = ROUTE_NAME_ALIASES[remainder];
  if (!routeName) {
    return { error: 'unknown-route', raw: text, remainder };
  }

  return {
    dayIndex,
    day: DAYS_OF_WEEK[dayIndex],
    routeName,
    remainder,
  };
};

export const indexPartiesByName = (parties) => {
  const map = new Map();
  (parties || []).forEach((party) => {
    const key = normalizeKey(party?.name || party?.partyName);
    if (!key || !party?.id) return;
    const list = map.get(key) || [];
    list.push(party);
    map.set(key, list);
  });
  return map;
};

const cloneRouteDays = (routeArray) => {
  const days = emptyWeek();
  (routeArray || []).forEach((day, index) => {
    const namedIndex = DAYS_OF_WEEK.indexOf(day?.day);
    const targetIndex = namedIndex >= 0 ? namedIndex : index;
    if (targetIndex < 0 || targetIndex > 6) return;
    days[targetIndex] = {
      ...(day || {}),
      day: DAYS_OF_WEEK[targetIndex],
      parties: [...(day?.parties || [])],
      fileNumber: day?.fileNumber ?? '',
    };
  });
  return days;
};

const partiesSignature = (days) =>
  JSON.stringify(days.map((day) => day.parties));

/**
 * Build the assignment list and the Firestore writes. Nothing is persisted here.
 * assignments are last-row-wins per party id.
 * writes.creates are new route documents.
 * writes.updates replace only the route array on an existing document.
 */
export const prepareRouteImport = ({ sheetRows, parties, existingRoutes }) => {
  const partyIndex = indexPartiesByName(parties);
  const issues = [];
  const byPartyId = new Map();
  let blankRoutes = 0;

  (sheetRows || []).forEach((row) => {
    if (!row.partyName) {
      issues.push({
        type: 'empty-party',
        rowNumber: row.rowNumber,
        message: 'Party name is empty.',
      });
      return;
    }

    const parsed =
      row.routeName !== undefined || row.day !== undefined
        ? parseRouteColumns(row.routeName, row.day)
        : parseRouteCell(row.routeText);
    if (parsed.blank) {
      blankRoutes += 1;
      issues.push({
        type: 'blank-route',
        rowNumber: row.rowNumber,
        partyName: row.partyName,
        message: 'Route name or day is blank. Current assignment is left unchanged.',
      });
      return;
    }
    if (parsed.error) {
      const source = row.routeText || row.day || row.routeName || '';
      issues.push({
        type: parsed.error,
        rowNumber: row.rowNumber,
        partyName: row.partyName,
        routeText: source,
        message:
          parsed.error === 'unknown-weekday'
            ? `Unknown day "${source}".`
            : `Unknown route name in "${source}".`,
      });
      return;
    }

    const matches = partyIndex.get(normalizeKey(row.partyName)) || [];
    if (matches.length === 0) {
      issues.push({
        type: 'party-not-found',
        rowNumber: row.rowNumber,
        partyName: row.partyName,
        routeName: parsed.routeName,
        day: parsed.day,
        message: `No party named "${row.partyName}".`,
      });
      return;
    }
    if (matches.length > 1) {
      issues.push({
        type: 'party-ambiguous',
        rowNumber: row.rowNumber,
        partyName: row.partyName,
        message: `More than one party is named "${row.partyName}".`,
      });
      return;
    }

    const partyId = matches[0].id;
    const previous = byPartyId.get(partyId);
    if (previous) {
      issues.push({
        type: 'duplicate-party',
        rowNumber: row.rowNumber,
        partyName: row.partyName,
        message: `Row ${row.rowNumber} replaces row ${previous.rowNumber} for this party.`,
      });
    }
    byPartyId.set(partyId, {
      partyId,
      partyName: row.partyName,
      routeName: parsed.routeName,
      dayIndex: parsed.dayIndex,
      day: parsed.day,
      rowNumber: row.rowNumber,
    });
  });

  const assignments = [...byPartyId.values()];
  const writes = buildRouteWrites(assignments, existingRoutes);

  writes.ambiguousRouteNames.forEach((routeName) => {
    issues.push({
      type: 'route-ambiguous',
      routeName,
      message: `More than one existing route is named "${routeName}". That route was not changed.`,
    });
  });

  const issueCount = (type) => issues.filter((issue) => issue.type === type).length;

  return {
    assignments,
    issues,
    writes,
    stats: {
      sheetRows: (sheetRows || []).length,
      blankRoutes,
      partyNotFound: issueCount('party-not-found'),
      partyAmbiguous: issueCount('party-ambiguous'),
      unknownRoute: issueCount('unknown-route') + issueCount('unknown-weekday') + issueCount('missing-route-name'),
      duplicatePartyRows: issueCount('duplicate-party'),
      assignedParties: assignments.filter(
        (assignment) =>
          !writes.skippedRouteNames.has(normalizeKey(assignment.routeName)),
      ).length,
      routesToCreate: writes.creates.length,
      routesToUpdate: writes.updates.length,
    },
  };
};

export const buildRouteWrites = (assignments, existingRoutes) => {
  const routesByKey = new Map();
  const ambiguousRouteNames = [];

  (existingRoutes || []).forEach((route) => {
    const key = normalizeKey(route?.name);
    if (!key || !route?.id) return;
    if (routesByKey.has(key)) {
      ambiguousRouteNames.push(route.name || key);
      routesByKey.get(key).ambiguous = true;
      return;
    }
    const days = cloneRouteDays(route.route);
    routesByKey.set(key, {
      id: route.id,
      name: route.name,
      days,
      original: partiesSignature(days),
      ambiguous: false,
      isNew: false,
    });
  });

  const skippedRouteNames = new Set(
    ambiguousRouteNames.map((name) => normalizeKey(name)),
  );

  assignments.forEach((assignment) => {
    const key = normalizeKey(assignment.routeName);
    if (skippedRouteNames.has(key) || routesByKey.get(key)?.ambiguous) {
      skippedRouteNames.add(key);
      return;
    }

    let route = routesByKey.get(key);
    if (!route) {
      const days = emptyWeek();
      route = {
        id: null,
        name: assignment.routeName,
        days,
        original: null,
        ambiguous: false,
        isNew: true,
      };
      routesByKey.set(key, route);
    }

    routesByKey.forEach((candidate) => {
      if (candidate.ambiguous) return;
      const isTarget = candidate === route;
      candidate.days.forEach((day, index) => {
        const keep = isTarget && index === assignment.dayIndex;
        if (keep) {
          if (!day.parties.includes(assignment.partyId)) {
            day.parties.push(assignment.partyId);
          }
        } else if (day.parties.includes(assignment.partyId)) {
          day.parties = day.parties.filter((id) => id !== assignment.partyId);
        }
      });
    });
  });

  const creates = [];
  const updates = [];
  routesByKey.forEach((route) => {
    if (route.ambiguous) return;
    if (route.isNew) {
      const hasParties = route.days.some((day) => day.parties.length > 0);
      if (hasParties) {
        creates.push({ name: route.name, route: route.days });
      }
      return;
    }
    if (partiesSignature(route.days) !== route.original) {
      updates.push({ id: route.id, route: route.days });
    }
  });

  return { creates, updates, ambiguousRouteNames, skippedRouteNames };
};

export const buildRouteExportRows = (partiesById, existingRoutes) => {
  const rows = [];
  (existingRoutes || []).forEach((route) => {
    (route?.route || []).forEach((day, index) => {
      const namedIndex = DAYS_OF_WEEK.indexOf(day?.day);
      const dayIndex = namedIndex >= 0 ? namedIndex : index;
      const dayName = DAYS_OF_WEEK[dayIndex] || '';
      (day?.parties || []).forEach((partyId) => {
        const party = partiesById?.[partyId];
        rows.push({
          'Party Name': party?.name || `Missing party ${partyId}`,
          'Route Name': route?.name || '',
          Day: dayName,
          dayIndex,
        });
      });
    });
  });

  rows.sort((a, b) => {
    const byRoute = a['Route Name'].localeCompare(b['Route Name']);
    if (byRoute !== 0) return byRoute;
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return a['Party Name'].localeCompare(b['Party Name']);
  });

  return rows.map((row) => ({
    'Party Name': row['Party Name'],
    'Route Name': row['Route Name'],
    Day: row.Day,
  }));
};
