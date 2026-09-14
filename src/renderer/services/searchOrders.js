import { getDocs, limit, query, where } from 'firebase/firestore';
import { getCompanyCollection, DB_NAMES } from './firestoreHelpers';

export function getBillNumberCandidates(billNumberInput) {
  const normalized = String(billNumberInput || '').trim();
  if (!normalized) return [];

  if (normalized.startsWith('*T-') || normalized.startsWith('T-')) {
    return [normalized];
  }

  if (normalized.startsWith('*')) {
    return [normalized];
  }

  const prefixed = `T-${normalized}`;
  return [prefixed, `*${prefixed}`];
}

export async function searchOrders(companyId, filters) {
  const { partyId, with: withValue, mrId, billNumber } = filters;
  const billNumberCandidates = getBillNumberCandidates(billNumber);

  const hasFilter =
    partyId || withValue || mrId || billNumberCandidates.length > 0;
  if (!hasFilter) return [];

  const ordersRef = getCompanyCollection(companyId, DB_NAMES.ORDERS);
  let dynamicQuery = ordersRef;

  if (partyId) {
    dynamicQuery = query(dynamicQuery, where('partyId', '==', partyId));
  }
  if (withValue) {
    dynamicQuery = query(dynamicQuery, where('with', '==', withValue));
  }
  if (mrId) {
    dynamicQuery = query(dynamicQuery, where('mrId', '==', mrId));
  }

  if (billNumberCandidates.length === 1) {
    dynamicQuery = query(
      dynamicQuery,
      where('billNumber', '==', billNumberCandidates[0]),
    );
  } else if (billNumberCandidates.length > 1) {
    dynamicQuery = query(
      dynamicQuery,
      where('billNumber', 'in', billNumberCandidates),
    );
  }

  dynamicQuery = query(dynamicQuery, limit(100));

  const querySnapshot = await getDocs(dynamicQuery);
  return querySnapshot.docs.map((docSnap) => ({
    ...docSnap.data(),
    id: docSnap.id,
  }));
}
