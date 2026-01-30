import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Dropdown,
  Input,
  Label,
  Option,
  Spinner,
} from '@fluentui/react-components';
import { Edit12Filled } from '@fluentui/react-icons';
import React, { useState, useEffect } from 'react';
import './style.css';
import { updateDoc } from 'firebase/firestore';
import { useSettingsContext } from '../../../../contexts/settingsContext';
import constants from '../../../../constants';
import { useCompany } from '../../../../contexts/companyContext';
import { getCompanyDoc, DB_NAMES } from '../../../../services/firestoreHelpers';
import { useCurrentUser } from '../../../../contexts/userContext';

export default function EditPartyDetails({ party, refreshParty }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(party?.name || '');
  const [area, setArea] = useState(party?.area || '');
  const [paymentTerms, setPaymentTerms] = useState(party?.paymentTerms || '');
  const [fileNumber, setFileNumber] = useState(party?.fileNumber || '');
  const [phone, setPhoneNumber] = useState(party?.fileNumber || '');
  const [creditDays, setCreditDays] = useState(
    party?.creditDays?.toString() || '',
  );

  const [loading, setLoading] = useState(false);
  const { settings } = useSettingsContext();
  const { currentCompanyId } = useCompany();
  const { user } = useCurrentUser();

  // Only managers/owners can edit credit days
  const canEditCreditDays = user?.isManager || false;

  const onSave = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Use company-scoped party document
      const partyRef = getCompanyDoc(currentCompanyId, DB_NAMES.PARTIES, party.id);

      // Update the fields
      const updateData = {
        name,
        area,
        paymentTerms,
        fileNumber,
      };

      // Only update creditDays if user is manager/owner
      if (canEditCreditDays) {
        // Parse and validate creditDays (null if empty/not set)
        if (creditDays.trim() !== '') {
          const parsed = parseInt(creditDays.trim(), 10);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 120) {
            updateData.creditDays = parsed;
          }
        } else {
          // Explicitly set to null to clear the field
          updateData.creditDays = null;
        }
      }

      await updateDoc(partyRef, updateData);
      refreshParty();
      setOpen(false);
      console.log('Document updated successfully');
    } catch (error) {
      console.error('Error updating document: ', error);
    }
    setLoading(false);
  };

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(party?.name || '');
      setArea(party?.area || '');
      setPaymentTerms(party?.paymentTerms || '');
      setFileNumber(party?.fileNumber || '');
      setCreditDays(party?.creditDays?.toString() || '');
    }
  }, [open, party]);

  return (
    <Dialog open={open}>
      <DialogTrigger disableButtonEnhancement>
        <Button onClick={() => setOpen(true)} appearance="subtle" size="small">
          <Edit12Filled />
        </Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Edit - {party.name}</DialogTitle>
          <DialogContent>
            {/* Name */}
            <div className="edit-party-input-container">
              <Label htmlFor="edit-party-name">Name</Label>
              <Input
                id="edit-party-name"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Area */}
            <div className="edit-party-input-container">
              <Label htmlFor="edit-party-area">Area</Label>
              <Input
                id="edit-party-area"
                placeholder="Arera"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </div>
            <div className="edit-party-input-container">
              <Label>File Number</Label>
              <Dropdown
                defaultValue={party.fileNumber}
                placeholder="File"
                onOptionSelect={(_, e) => {
                  setFileNumber(e.optionValue);
                }}
              >
                {settings?.fileNumbers?.data.map((option) => (
                  <Option text={option} value={option} key={option}>
                    {option}
                  </Option>
                ))}
              </Dropdown>
            </div>
            <div className="edit-party-input-container">
              <Label>Payment terms</Label>
              <Dropdown
                onOptionSelect={(_, e) => setPaymentTerms(e.optionValue)}
                className="dropdown filter-input"
                placeholder="Payment Terms"
                defaultValue={paymentTerms}
              >
                {constants.paymentTermsListItems.map((x) => (
                  <Option
                    text={x}
                    value={x}
                    key={`accounts-with-dropdown ${x}`}
                  >
                    {x}
                  </Option>
                ))}
              </Dropdown>
            </div>
            {canEditCreditDays && (
              <div className="edit-party-input-container">
                <Label htmlFor="edit-party-credit-days">Credit Days</Label>
                <Input
                  id="edit-party-credit-days"
                  type="number"
                  min={1}
                  max={120}
                  placeholder="Leave empty if not set (1-120)"
                  value={creditDays}
                  onChange={(e) => setCreditDays(e.target.value)}
                />
                <small style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Number of days before payment is due. Leave empty if not set.
                </small>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button onClick={() => setOpen(false)} appearance="secondary">
                Close
              </Button>
            </DialogTrigger>
            <DialogTrigger>
              <Button onClick={() => onSave()} appearance="primary">
                {loading ? <Spinner size="tiny" /> : 'Save'}
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
