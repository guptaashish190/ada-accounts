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
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useCompany } from '../../contexts/companyContext';
import { firebaseStorage } from '../../firebaseInit';
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
  const [imageItems, setImageItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const { currentCompanyId } = useCompany();

  const normalizeExistingImages = (p) => {
    if (!p) return [];
    const rawList = Array.isArray(p.imageUrls)
      ? p.imageUrls
      : [p.mainImageUrl, p.imageUrl, p.photoUrl, p.image];
    const urls = [...new Set(rawList.map((u) => (u || '').trim()).filter(Boolean))];
    return urls.map((url) => ({ url, file: null, previewUrl: '' }));
  };

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
        setImageItems(normalizeExistingImages(product));
      } else {
        setForm(EMPTY_FORM);
        setImageItems([]);
      }
    }
    if (!open) {
      setImageItems((prev) => {
        prev.forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        return [];
      });
    }
  }, [open, product]);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const onPickImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const additions = files.map((file) => ({
      file,
      url: '',
      previewUrl: URL.createObjectURL(file),
    }));
    setImageItems((prev) => [...prev, ...additions]);
    e.target.value = '';
  };

  const removeImageAt = (index) => {
    setImageItems((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const moveImage = (index, direction) => {
    setImageItems((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const clone = [...prev];
      const temp = clone[index];
      clone[index] = clone[nextIndex];
      clone[nextIndex] = temp;
      return clone;
    });
  };

  const setAsMain = (index) => {
    setImageItems((prev) => {
      if (index <= 0 || index >= prev.length) return prev;
      const clone = [...prev];
      const [selected] = clone.splice(index, 1);
      return [selected, ...clone];
    });
  };

  const uploadProductImage = async (file, companyId, productId, index) => {
    const extension = file.name?.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `companies/${companyId}/products/${productId}/${index}-${Date.now()}.${extension}`;
    const storageReference = storageRef(firebaseStorage, path);
    const uploaded = await uploadBytes(storageReference, file);
    return getDownloadURL(uploaded.ref);
  };

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

      let productId = product?.id;
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
        productId = docRef.id;
        await updateDoc(docRef, { id: docRef.id });
      }

      const imageUrls = (
        await Promise.all(
          imageItems.map(async (item, index) => {
            if (item.file) {
              // Keep upload order equal to UI order so first remains main.
              return uploadProductImage(
                item.file,
                currentCompanyId,
                productId,
                index,
              );
            }
            return item.url || '';
          }),
        )
      ).filter(Boolean);
      const mainImageUrl = imageUrls[0] || '';
      if (productId) {
        const ref = getCompanyDoc(
          currentCompanyId,
          DB_NAMES.PRODUCTS,
          productId,
        );
        await updateDoc(ref, {
          imageUrls,
          mainImageUrl,
          imageUrl: mainImageUrl,
        });
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

              <div className="field-row">
                <Label htmlFor="prod-images">Product Images</Label>
                <Input id="prod-images" type="file" accept="image/*" multiple onChange={onPickImages} />
                {imageItems.length > 0 && (
                  <div className="product-images-grid">
                    {imageItems.map((item, index) => {
                      const src = item.previewUrl || item.url;
                      return (
                        <div
                          key={src || `img-${index}`}
                          className={`product-image-tile ${index === 0 ? 'is-main' : ''}`}
                        >
                          {src ? (
                            <img src={src} alt={`product-${index}`} />
                          ) : (
                            <div className="product-image-fallback">No image</div>
                          )}
                          <div className="product-image-actions">
                            <Button
                              size="small"
                              appearance="subtle"
                              disabled={index === 0}
                              onClick={() => setAsMain(index)}
                            >
                              Main
                            </Button>
                            <Button
                              size="small"
                              appearance="subtle"
                              disabled={index === 0}
                              onClick={() => moveImage(index, -1)}
                            >
                              ◀
                            </Button>
                            <Button
                              size="small"
                              appearance="subtle"
                              disabled={index === imageItems.length - 1}
                              onClick={() => moveImage(index, 1)}
                            >
                              ▶
                            </Button>
                            <Button
                              size="small"
                              appearance="subtle"
                              onClick={() => removeImageAt(index)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
