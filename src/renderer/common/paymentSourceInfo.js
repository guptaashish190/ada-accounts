import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spinner, Text } from '@fluentui/react-components';
import { resolvePaymentSourceRefs } from '../services/paymentSourceUtils';
import { useCompany } from '../contexts/companyContext';

export function PaymentSourceInfo({
  sourceRefs = [],
  partyId,
  showNotes = true,
  navigateOnClick = true,
}) {
  const navigate = useNavigate();
  const { currentCompanyId } = useCompany();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentCompanyId || !sourceRefs?.length) {
      setSources([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const entries = await resolvePaymentSourceRefs(
          currentCompanyId,
          partyId,
          sourceRefs,
        );
        if (!cancelled) setSources(entries);
      } catch (error) {
        console.error('Error loading payment sources:', error);
        if (!cancelled) setSources([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentCompanyId, partyId, sourceRefs]);

  if (!sourceRefs?.length) {
    return <Text size={300}>--</Text>;
  }

  if (loading) {
    return <Spinner size="tiny" />;
  }

  const navigateToSource = (ref) => {
    if (!navigateOnClick) return;
    if (ref.sourceType === 'bundle') {
      navigate('/bundles', { state: { bundleId: ref.sourceId } });
    } else {
      navigate('/viewSupplyReport', {
        state: { supplyReportId: ref.sourceId },
      });
    }
  };

  return (
    <div>
      {sources.map((entry) => (
        <div key={`${entry.sourceType}-${entry.sourceId}`}>
          {navigateOnClick ? (
            <Button
              appearance="subtle"
              size="small"
              onClick={() => navigateToSource(entry)}
            >
              {entry.label}
            </Button>
          ) : (
            <Text size={300}>{entry.label}</Text>
          )}
          {showNotes && entry.notes ? (
            <Text size={200}>
              Notes: <b>{entry.notes}</b>
            </Text>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function PaymentSourceNotesText({ accountsNotes }) {
  if (!accountsNotes || accountsNotes === '--') {
    return <Text size={300}>--</Text>;
  }
  return <Text size={300}>{accountsNotes}</Text>;
}
