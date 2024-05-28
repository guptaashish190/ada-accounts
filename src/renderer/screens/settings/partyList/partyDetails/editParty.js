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
import React, { useState } from 'react';
import './style.css';
import { doc, updateDoc } from 'firebase/firestore';
import { useSettingsContext } from '../../../../contexts/settingsContext';
import { firebaseDB } from '../../../../firebaseInit';
import constants from '../../../../constants';

export default function EditPartyDetails({ party, refreshParty }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(party?.name || '');
  const [area, setArea] = useState(party?.area || '');
  const [paymentTerms, setPaymentTerms] = useState(party?.paymentTerms || '');
  const [fileNumber, setFileNumber] = useState(party?.fileNumber || '');
  const [phone, setPhoneNumber] = useState(party?.fileNumber || '');

  const [loading, setLoading] = useState(false);
  const { settings } = useSettingsContext();

  const onSave = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Assuming 'parties' is the name of your collection
      const partyRef = doc(firebaseDB, 'parties', party.id);

      // Update the fields
      await updateDoc(partyRef, {
        name,
        area,
        paymentTerms,
        fileNumber,
      });
      refreshParty();
      setOpen(false);
      console.log('Document updated successfully');
    } catch (error) {
      console.error('Error updating document: ', error);
    }
    setLoading(false);
  };

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
