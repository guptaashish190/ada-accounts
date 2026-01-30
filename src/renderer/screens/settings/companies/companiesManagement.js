/**
 * Companies Management Screen
 *
 * Allows admins/owners to:
 * - View all companies
 * - Create new companies
 * - Edit existing companies
 * - Activate/deactivate companies
 */

import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  Text,
  Switch,
  Toaster,
  useId,
  useToastController,
} from '@fluentui/react-components';
import {
  BuildingMultiple24Regular,
  Add24Regular,
  Edit24Regular,
} from '@fluentui/react-icons';
import { doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { firebaseDB } from '../../../firebaseInit';
import { getCompaniesCollection } from '../../../services/firestoreHelpers';
import { showToast } from '../../../common/toaster';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';
import './style.css';

export default function CompaniesManagementScreen() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const toasterId = useId('companies-toaster');
  const { dispatchToast } = useToastController(toasterId);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      // Fetch all companies (active and inactive)
      const companiesRef = getCompaniesCollection();
      const querySnapshot = await getDocs(companiesRef);

      const allCompanies = [];
      querySnapshot.forEach((docSnap) => {
        allCompanies.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });

      // Sort by name
      allCompanies.sort((a, b) => a.name.localeCompare(b.name));
      setCompanies(allCompanies);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching companies:', error);
      showToast(dispatchToast, 'Failed to load companies', 'error');
      setLoading(false);
    }
  };

  const handleCreateCompany = async (companyData) => {
    try {
      // Generate company ID from name (lowercase, replace spaces with hyphens)
      const companyId = companyData.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const companyRef = doc(firebaseDB, 'companies', companyId);

      // Check if company already exists
      const companiesRef = getCompaniesCollection();
      const existingDocs = await getDocs(companiesRef);
      const exists = existingDocs.docs.some((d) => d.id === companyId);

      if (exists) {
        showToast(
          dispatchToast,
          'Company with this name already exists',
          'error',
        );
        return false;
      }

      await setDoc(companyRef, {
        name: companyData.name,
        shortCode: companyData.shortCode || '',
        isActive: companyData.isActive !== false,
        createdAt: new Date().toISOString(),
      });

      showToast(dispatchToast, 'Company created successfully', 'success');
      await fetchCompanies();
      return true;
    } catch (error) {
      console.error('Error creating company:', error);
      showToast(dispatchToast, 'Failed to create company', 'error');
      return false;
    }
  };

  const handleUpdateCompany = async (companyId, companyData) => {
    try {
      const companyRef = doc(firebaseDB, 'companies', companyId);
      await updateDoc(companyRef, {
        name: companyData.name,
        shortCode: companyData.shortCode || '',
        isActive: companyData.isActive !== false,
        updatedAt: new Date().toISOString(),
      });

      showToast(dispatchToast, 'Company updated successfully', 'success');
      await fetchCompanies();
      return true;
    } catch (error) {
      console.error('Error updating company:', error);
      showToast(dispatchToast, 'Failed to update company', 'error');
      return false;
    }
  };

  const handleToggleActive = async (company) => {
    try {
      const companyRef = doc(firebaseDB, 'companies', company.id);
      await updateDoc(companyRef, {
        isActive: !company.isActive,
        updatedAt: new Date().toISOString(),
      });

      showToast(
        dispatchToast,
        `Company ${!company.isActive ? 'activated' : 'deactivated'}`,
        'success',
      );
      await fetchCompanies();
    } catch (error) {
      console.error('Error toggling company status:', error);
      showToast(dispatchToast, 'Failed to update company status', 'error');
    }
  };

  if (loading) {
    return (
      <center>
        <Spinner size="large" />
      </center>
    );
  }

  return (
    <>
      <Toaster toasterId={toasterId} />
      <div className="companies-management-container">
        <div className="companies-header">
          <div className="header-title">
            <BuildingMultiple24Regular />
            <Text size={600} weight="semibold">
              Companies Management
            </Text>
          </div>
        </div>

        <VerticalSpace2 />

        <Card>
          <CardHeader
            header={<Text weight="semibold">All Companies</Text>}
            action={
              <Button
                appearance="primary"
                icon={<Add24Regular />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Company
              </Button>
            }
          />
          <div className="companies-table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Short Code</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Text>
                        No companies found. Create your first company.
                      </Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <Text weight="medium">{company.name}</Text>
                      </TableCell>
                      <TableCell>
                        <Text>{company.shortCode || '-'}</Text>
                      </TableCell>
                      <TableCell>
                        <div className="switch-container">
                          <Switch
                            checked={company.isActive !== false}
                            onChange={() => handleToggleActive(company)}
                          />
                          <Text size={200} className="switch-label">
                            {company.isActive !== false ? 'Active' : 'Inactive'}
                          </Text>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          appearance="subtle"
                          icon={<Edit24Regular />}
                          onClick={() => {
                            setSelectedCompany(company);
                            setEditDialogOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <CreateCompanyDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSave={handleCreateCompany}
        />

        {selectedCompany && (
          <EditCompanyDialog
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) {
                setSelectedCompany(null);
              }
            }}
            company={selectedCompany}
            onSave={(data) => {
              handleUpdateCompany(selectedCompany.id, data);
              setEditDialogOpen(false);
              setSelectedCompany(null);
            }}
          />
        )}
      </div>
    </>
  );
}

/**
 * Dialog for creating a new company
 */
function CreateCompanyDialog({ open, onOpenChange, onSave }) {
  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }

    setSaving(true);
    const success = await onSave({
      name: name.trim(),
      shortCode: shortCode.trim(),
      isActive,
    });

    if (success) {
      setName('');
      setShortCode('');
      setIsActive(true);
      onOpenChange(false);
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setName('');
    setShortCode('');
    setIsActive(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Create New Company</DialogTitle>
          <DialogContent>
            <div className="company-form">
              <div className="form-field">
                <Label htmlFor="company-name" required>
                  Company Name
                </Label>
                <Input
                  id="company-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter company name"
                  required
                />
              </div>
              <VerticalSpace1 />
              <div className="form-field">
                <Label htmlFor="company-shortcode">Short Code (Optional)</Label>
                <Input
                  id="company-shortcode"
                  value={shortCode}
                  onChange={(e) => setShortCode(e.target.value)}
                  placeholder="e.g., ADA"
                  maxLength={10}
                />
              </div>
              <VerticalSpace1 />
              <div className="form-field">
                <Switch
                  checked={isActive}
                  onChange={(e, data) => setIsActive(data.checked)}
                  label="Active"
                />
                <Text size={200} className="form-hint">
                  Inactive companies won't appear in selection lists
                </Text>
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button
                appearance="primary"
                onClick={handleSave}
                disabled={!name.trim() || saving}
              >
                {saving ? 'Creating...' : 'Create'}
              </Button>
            </DialogTrigger>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/**
 * Dialog for editing an existing company
 */
function EditCompanyDialog({ open, onOpenChange, company, onSave }) {
  const [name, setName] = useState(company?.name || '');
  const [shortCode, setShortCode] = useState(company?.shortCode || '');
  const [isActive, setIsActive] = useState(company?.isActive !== false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company) {
      setName(company.name || '');
      setShortCode(company.shortCode || '');
      setIsActive(company.isActive !== false);
    }
  }, [company]);

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }

    setSaving(true);
    await onSave({
      name: name.trim(),
      shortCode: shortCode.trim(),
      isActive,
    });
    setSaving(false);
  };

  const handleCancel = () => {
    if (company) {
      setName(company.name || '');
      setShortCode(company.shortCode || '');
      setIsActive(company.isActive !== false);
    }
    if (typeof onOpenChange === 'function') {
      onOpenChange(false);
    }
  };

  if (!company) return null;

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Edit Company</DialogTitle>
          <DialogContent>
            <div className="company-form">
              <div className="form-field">
                <Label htmlFor="edit-company-name" required>
                  Company Name
                </Label>
                <Input
                  id="edit-company-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter company name"
                  required
                />
              </div>
              <VerticalSpace1 />
              <div className="form-field">
                <Label htmlFor="edit-company-shortcode">
                  Short Code (Optional)
                </Label>
                <Input
                  id="edit-company-shortcode"
                  value={shortCode}
                  onChange={(e) => setShortCode(e.target.value)}
                  placeholder="e.g., ADA"
                  maxLength={10}
                />
              </div>
              <VerticalSpace1 />
              <div className="form-field">
                <Switch
                  checked={isActive}
                  onChange={(e, data) => setIsActive(data.checked)}
                  label="Active"
                />
                <Text size={200} className="form-hint">
                  Inactive companies won't appear in selection lists
                </Text>
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button
                appearance="primary"
                onClick={handleSave}
                disabled={!name.trim() || saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogTrigger>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
