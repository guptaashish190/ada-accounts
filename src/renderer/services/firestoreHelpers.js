/**
 * Firestore Helpers for Company-Scoped Collections
 * Story 0.6 Desktop Implementation
 *
 * This module provides helper functions to access company-scoped Firestore collections.
 * All company data lives under /companies/{companyId}/...
 */

import { collection, doc, getDoc, getDocs, query } from 'firebase/firestore';
import { firebaseDB } from '../firebaseInit';

// Default company ID for backward compatibility during migration
export const DEFAULT_COMPANY_ID = 'ashish-drug-agencies';

// Root-level collections that are NOT company-scoped
const ROOT_COLLECTIONS = ['users', 'companies'];

/**
 * Get a reference to a company-scoped collection
 * @param {string} companyId - The company ID
 * @param {string} collectionName - The collection name (e.g., 'orders', 'parties')
 * @returns {CollectionReference} Firestore collection reference
 */
export const getCompanyCollection = (companyId, collectionName) => {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  return collection(firebaseDB, 'companies', targetCompanyId, collectionName);
};

/**
 * Get a reference to a company-scoped document
 * @param {string} companyId - The company ID
 * @param {string} collectionName - The collection name
 * @param {string} docId - The document ID
 * @returns {DocumentReference} Firestore document reference
 */
export const getCompanyDoc = (companyId, collectionName, docId) => {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  return doc(firebaseDB, 'companies', targetCompanyId, collectionName, docId);
};

/**
 * Get the companies collection (root level)
 * @returns {CollectionReference} Firestore collection reference
 */
export const getCompaniesCollection = () => {
  return collection(firebaseDB, 'companies');
};

/**
 * Get the users collection (root level)
 * @returns {CollectionReference} Firestore collection reference
 */
export const getUsersCollection = () => {
  return collection(firebaseDB, 'users');
};

/**
 * Fetch all active companies
 * @returns {Promise<Array>} Array of company objects
 */
export const fetchActiveCompanies = async () => {
  try {
    const companiesRef = collection(firebaseDB, 'companies');
    const querySnapshot = await getDocs(companiesRef);

    const companies = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.isActive !== false) {
        companies.push({
          id: docSnap.id,
          ...data,
        });
      }
    });

    return companies;
  } catch (error) {
    console.error('Error fetching companies:', error);
    return [];
  }
};

/**
 * Collection name constants (matching mobile app)
 */
export const DB_NAMES = {
  ORDERS: 'orders',
  PARTIES: 'parties',
  PURCHASE_PARTIES: 'purchaseParties',
  CASH_RECEIPTS: 'cashReceipts',
  SUPPLY_REPORTS: 'supplyReports',
  VOUCHERS: 'vouchers',
  ATTENDANCE: 'attendance',
  MR_ROUTES: 'mr_routes',
  JOBS: 'jobs',
  NOTIFICATIONS: 'notifications',
  COUNTERS: 'counters',
  UPI: 'upi',
  CHEQUES: 'cheques',
  CREDIT_NOTES: 'creditNotes',
  BILL_BUNDLES: 'billBundles',
  USERS: 'users',
  COMPANIES: 'companies',
  USER_REQUESTS: 'userRequests',
  SETTINGS: 'settings',
};

export default {
  getCompanyCollection,
  getCompanyDoc,
  getCompaniesCollection,
  getUsersCollection,
  fetchActiveCompanies,
  DEFAULT_COMPANY_ID,
  DB_NAMES,
};
