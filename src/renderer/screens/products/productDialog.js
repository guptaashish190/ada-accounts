import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Input,
  Label,
  Spinner,
  Switch,
} from '@fluentui/react-components';
import { addDoc, updateDoc } from 'firebase/firestore';
import { useCompany } from '../../contexts/companyContext';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../services/firestoreHelpers';
import './style.css';

const EMPTY_FORM = {
  name: '',
  company: '',
  packSize: '',
  mrp: '',
  composition: '',
  isActive: true,
};

export default function ProductDialog({ open, onClose, product, onSaved }) {
  const isEdit = Boolean(product);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const { currentCompanyId } = useCompany();

  useEffect(() => {
    if (open) {
      if (product) {
        setForm({
          name: product.name || product.Name || '',
          company: product.company || product.Company || product.brand || product.Brand || '',
          packSize: product.packSize || product.Pack || product.pack || product.Unit || '',
          mrp: (product.mrp ?? product.MRP ?? product.Mrp ?? '')?.toString() || '',
          composition: product.composition || product.Composition || product.comp || '',
          isActive: product.isActive !== false,
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, product]);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const onSave = async () => {
    if (!form.name.trim()) return;
    if (loading) return;
    setLoading(true);

    try {
      const nameVal = form.name.trim();
      const data = {
        name: nameVal,
        Name: nameVal.toUpperCase(),
        company: form.company.trim(),
        packSize: form.packSize.trim(),
        mrp: parseFloat(form.mrp) || 0,
        composition: form.composition.trim(),
        isActive: form.isActive,
      };

      if (isEdit) {
        const ref = getCompanyDoc(
          currentCompanyId,
          DB_NAMES.PRODUCTS,
          product.id,
        );
        await updateDoc(ref, data);
      } else {
        const colRef = getCompanyCollection(
          currentCompanyId,
          DB_NAMES.PRODUCTS,
        );
        const docRef = await addDoc(colRef, data);
        await updateDoc(docRef, { id: docRef.id });
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Error saving product:', err);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{isEdit ? `Edit — ${product?.name || product?.Name || ''}` : 'Add Product'}</DialogTitle>
          <DialogContent>
            <div className="product-dialog-form">
              <div className="field-row">
                <Label required htmlFor="prod-name">Product Name</Label>
                <Input
                  id="prod-name"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. Crocin 500mg"
                  autoFocus
                />
              </div>

              <div className="field-row-inline">
                <div className="field-row">
                  <Label htmlFor="prod-company">Company / Brand</Label>
                  <Input
                    id="prod-company"
                    value={form.company}
                    onChange={set('company')}
                    placeholder="e.g. GSK"
                  />
                </div>
                <div className="field-row">
                  <Label htmlFor="prod-pack">Pack Size</Label>
                  <Input
                    id="prod-pack"
                    value={form.packSize}
                    onChange={set('packSize')}
                    placeholder="e.g. 10 Tab"
                  />
                </div>
              </div>

              <div className="field-row-inline">
                <div className="field-row">
                  <Label htmlFor="prod-mrp">MRP</Label>
                  <Input
                    id="prod-mrp"
                    type="number"
                    value={form.mrp}
                    onChange={set('mrp')}
                    placeholder="0.00"
                  />
                </div>
                <div className="field-row">
                  <Label htmlFor="prod-composition">Composition</Label>
                  <Input
                    id="prod-composition"
                    value={form.composition}
                    onChange={set('composition')}
                    placeholder="e.g. Paracetamol"
                  />
                </div>
              </div>

              {isEdit && (
                <div className="field-row">
                  <Switch
                    checked={form.isActive}
                    onChange={(_, data) =>
                      setForm((prev) => ({ ...prev, isActive: data.checked }))
                    }
                    label={form.isActive ? 'Active' : 'Inactive'}
                  />
                </div>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} appearance="secondary">
              Cancel
            </Button>
            <Button onClick={onSave} appearance="primary" disabled={!form.name.trim()}>
              {loading ? <Spinner size="tiny" /> : isEdit ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
