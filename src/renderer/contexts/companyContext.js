/* eslint-disable react/jsx-no-constructed-context-values */
/**
 * Company Context for Multi-Company Support
 * Story 0.3/0.4 Desktop Implementation
 *
 * Manages:
 * - Current company ID state
 * - Company selection for first-time login
 * - Company switching for owners
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { firebaseDB, firebaseAuth } from '../firebaseInit';
import {
  DEFAULT_COMPANY_ID,
  fetchActiveCompanies,
} from '../services/firestoreHelpers';
import Loader from '../common/loader';

const CompanyContext = createContext(null);

/**
 * Hook to access company context
 * @returns {{ currentCompanyId: string, canSwitchCompany: boolean, companies: Array, switchCompany: Function }}
 */
export const useCompany = () => {
  const context = useContext(CompanyContext);
  // Return safe defaults if context is not yet available
  if (!context) {
    return {
      currentCompanyId: DEFAULT_COMPANY_ID,
      canSwitchCompany: false,
      companies: [],
      needsCompanySelection: false,
      switchCompany: () => {},
      saveSelectedCompany: async () => false,
      getCurrentCompanyName: () => 'Company',
    };
  }
  return context;
};

/**
 * Company Provider Component
 * Wraps app to provide company context
 */
export default function CompanyProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [currentCompanyId, setCurrentCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [canSwitchCompany, setCanSwitchCompany] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [needsCompanySelection, setNeedsCompanySelection] = useState(false);

  // Load user's company settings and available companies
  const initializeCompany = async () => {
    try {
      // Guard: ensure we have a current user
      if (!firebaseAuth.currentUser) {
        console.warn('No current user found');
        setLoading(false);
        return;
      }

      // Get user document from root /users collection
      const userDocRef = doc(firebaseDB, 'users', firebaseAuth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();

        // Check if user needs to select company (first login for employee)
        if (!userData.companyId || userData.companyId === '') {
          setNeedsCompanySelection(true);
          // Fetch companies for selection
          const activeCompanies = await fetchActiveCompanies();
          setCompanies(activeCompanies || []);
        } else {
          // User has company assigned
          setCurrentCompanyId(userData.companyId);
          setCanSwitchCompany(userData.canSwitchCompany || false);

          // If user can switch, load all companies
          if (userData.canSwitchCompany) {
            const activeCompanies = await fetchActiveCompanies();
            setCompanies(activeCompanies || []);
          }
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error initializing company context:', error);
      // Fallback to default company
      setCurrentCompanyId(DEFAULT_COMPANY_ID);
      setCompanies([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initialize company context when component mounts
    initializeCompany();
  }, []);

  /**
   * Switch to a different company (for owners only)
   * @param {string} companyId - The company ID to switch to
   */
  const switchCompany = (companyId) => {
    if (!canSwitchCompany) {
      console.warn('User cannot switch companies');
      return;
    }
    setCurrentCompanyId(companyId);
    // Note: Data will re-fetch automatically when components use the new companyId
  };

  /**
   * Save selected company for first-time employee login
   * @param {string} companyId - The selected company ID
   */
  const saveSelectedCompany = async (companyId) => {
    try {
      const userDocRef = doc(firebaseDB, 'users', firebaseAuth.currentUser.uid);
      await updateDoc(userDocRef, {
        companyId: companyId,
        canSwitchCompany: false,
      });

      setCurrentCompanyId(companyId);
      setCanSwitchCompany(false);
      setNeedsCompanySelection(false);

      return true;
    } catch (error) {
      console.error('Error saving company selection:', error);
      return false;
    }
  };

  /**
   * Get current company name
   */
  const getCurrentCompanyName = () => {
    const company = companies.find((c) => c.id === currentCompanyId);
    return company?.name || 'Company';
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <CompanyContext.Provider
      value={{
        currentCompanyId,
        canSwitchCompany,
        companies,
        needsCompanySelection,
        switchCompany,
        saveSelectedCompany,
        getCurrentCompanyName,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}
