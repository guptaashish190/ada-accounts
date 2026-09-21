/* eslint-disable react/jsx-no-constructed-context-values */
import { createContext, useContext, useEffect, useState } from 'react';
import { getDocs } from 'firebase/firestore';
import { useCompany } from './companyContext';
import { getCompanyCollection, DB_NAMES } from '../services/firestoreHelpers';

const Context = createContext('');

export const useAllParties = () => useContext(Context);

export default function AllPartiesContext({ children }) {
  const [parties, setParties] = useState([]);
  const { currentCompanyId } = useCompany();

  const reloadParties = async () => {
    if (!currentCompanyId) return;
    try {
      const snapshot = await getDocs(
        getCompanyCollection(currentCompanyId, DB_NAMES.PARTIES),
      );
      setParties(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error loading parties:', error);
    }
  };

  useEffect(() => {
    reloadParties();
  }, [currentCompanyId]);

  return (
    <Context.Provider value={{ parties, reloadParties }}>
      {children}
    </Context.Provider>
  );
}
