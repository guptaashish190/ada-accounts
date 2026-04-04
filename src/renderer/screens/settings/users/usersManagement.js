/**
 * Users Management Screen
 *
 * Allows managers/owners to:
 * - View all users (active and deactivated)
 * - Create new users
 * - Edit existing users (jobs, company, manager status)
 * - Activate/deactivate users
 * - Filter by company, status, jobs
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
  Dropdown,
  Option,
  Badge,
  Image,
  Checkbox,
} from '@fluentui/react-components';
import {
  People24Regular,
  Add24Regular,
  Edit24Regular,
  Person24Regular,
} from '@fluentui/react-icons';
import {
  doc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseDB, firebaseAuth } from '../../../firebaseInit';
import { getUsersCollection, getCompanyCollection, DB_NAMES } from '../../../services/firestoreHelpers';
import { showToast } from '../../../common/toaster';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';
import { useCompany } from '../../../contexts/companyContext';
import { useAuthUser } from '../../../contexts/allUsersContext';
import './style.css';

export default function UsersManagementScreen() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');

  const { currentCompanyId } = useCompany();
  const { allUsers } = useAuthUser();
  const toasterId = useId('users-toaster');
  const { dispatchToast } = useToastController(toasterId);

  useEffect(() => {
    fetchData();
  }, [currentCompanyId]);

  useEffect(() => {
    applyFilters();
  }, [users, filterCompany, filterStatus, searchQuery]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch users (root collection)
      const usersRef = getUsersCollection();
      const usersSnapshot = await getDocs(usersRef);
      const usersList = [];
      usersSnapshot.forEach((docSnap) => {
        usersList.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });
      setUsers(usersList);

      // Fetch jobs (company-scoped)
      const jobsRef = getCompanyCollection(currentCompanyId, DB_NAMES.JOBS);
      const jobsSnapshot = await getDocs(jobsRef);
      const jobsList = [];
      jobsSnapshot.forEach((docSnap) => {
        jobsList.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });
      setJobs(jobsList);

      // Fetch companies (root collection)
      const companiesRef = collection(firebaseDB, 'companies');
      const companiesSnapshot = await getDocs(companiesRef);
      const companiesList = [];
      companiesSnapshot.forEach((docSnap) => {
        companiesList.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });
      setCompanies(companiesList);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast(dispatchToast, 'Failed to load data', 'error');
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...users];

    // Filter by company
    if (filterCompany !== 'all') {
      filtered = filtered.filter((user) => user.companyId === filterCompany);
    }

    // Filter by status
    if (filterStatus === 'active') {
      filtered = filtered.filter((user) => !user.isDeactivated);
    } else if (filterStatus === 'deactivated') {
      filtered = filtered.filter((user) => user.isDeactivated);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.username?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.uid?.toLowerCase().includes(query)
      );
    }

    // Sort by username
    filtered.sort((a, b) => (a.username || '').localeCompare(b.username || ''));

    setFilteredUsers(filtered);
  };

  const handleCreateUser = async (userData) => {
    try {
      // Create Firebase Auth user
      const email = `${userData.username}@gmail.com`;
      const userCredential = await createUserWithEmailAndPassword(
        firebaseAuth,
        email,
        userData.password
      );

      const uid = userCredential.user.uid;

      // Create user document in Firestore
      const userRef = doc(firebaseDB, 'users', uid);
      await setDoc(userRef, {
        uid,
        username: userData.username,
        email: email,
        profilePicture: '',
        isManager: userData.isManager || false,
        jobs: userData.jobs || [],
        assignedMRs: [],
        assignedRoute: '',
        assignedCallOrderSchedule: '',
        assignedPurchaseOrderSchedule: '',
        cid: userData.companyId || currentCompanyId,
        isDeactivated: false,
        companyId: userData.companyId || currentCompanyId,
        canSwitchCompany: userData.canSwitchCompany || false,
      });

      showToast(dispatchToast, 'User created successfully', 'success');
      await fetchData();
      return true;
    } catch (error) {
      console.error('Error creating user:', error);
      const errorMessage =
        error.code === 'auth/email-already-in-use'
          ? 'Username already exists'
          : error.message || 'Failed to create user';
      showToast(dispatchToast, errorMessage, 'error');
      return false;
    }
  };

  const handleUpdateUser = async (userId, userData) => {
    try {
      const userRef = doc(firebaseDB, 'users', userId);
      await updateDoc(userRef, {
        username: userData.username,
        email: userData.email,
        isManager: userData.isManager || false,
        jobs: userData.jobs || [],
        companyId: userData.companyId,
        canSwitchCompany: userData.canSwitchCompany || false,
      });

      showToast(dispatchToast, 'User updated successfully', 'success');
      await fetchData();
      return true;
    } catch (error) {
      console.error('Error updating user:', error);
      showToast(dispatchToast, 'Failed to update user', 'error');
      return false;
    }
  };

  const handleToggleDeactivated = async (user) => {
    try {
      const userRef = doc(firebaseDB, 'users', user.id);
      await updateDoc(userRef, {
        isDeactivated: !user.isDeactivated,
      });

      showToast(
        dispatchToast,
        `User ${!user.isDeactivated ? 'deactivated' : 'activated'}`,
        'success'
      );
      await fetchData();
    } catch (error) {
      console.error('Error toggling user status:', error);
      showToast(dispatchToast, 'Failed to update user status', 'error');
    }
  };

  const getJobNames = (jobIds) => {
    if (!jobIds || !Array.isArray(jobIds)) return [];
    return jobIds
      .map((jobId) => {
        const job = jobs.find((j) => j.id === jobId);
        return job ? job.name : jobId;
      })
      .filter(Boolean);
  };

  const getCompanyName = (companyId) => {
    if (!companyId) return '-';
    const company = companies.find((c) => c.id === companyId);
    return company ? company.name : companyId;
  };

  if (loading) {
    return (
      <div className="users-management-container">
        <Spinner label="Loading users..." />
      </div>
    );
  }

  return (
    <>
      <Toaster toasterId={toasterId} />
      <div className="users-management-container">
        <Card>
          <CardHeader
            header={
              <div className="users-header">
                <div className="header-title">
                  <People24Regular />
                  <Text size={500} weight="semibold">
                    Users Management
                  </Text>
                </div>
                <Button
                  appearance="primary"
                  icon={<Add24Regular />}
                  onClick={() => setCreateDialogOpen(true)}
                >
                  Create User
                </Button>
              </div>
            }
          />
          
          {/* Filters */}
          <div className="users-filters">
            <div className="filter-group">
              <Label>Search</Label>
              <Input
                placeholder="Search by username, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '250px' }}
              />
            </div>
            <div className="filter-group">
              <Label>Company</Label>
              <Dropdown
                value={filterCompany}
                onOptionSelect={(e, data) => setFilterCompany(data.optionValue)}
                style={{ width: '200px' }}
              >
                <Option value="all">All Companies</Option>
                {companies.map((company) => (
                  <Option key={company.id} value={company.id}>
                    {company.name}
                  </Option>
                ))}
              </Dropdown>
            </div>
            <div className="filter-group">
              <Label>Status</Label>
              <Dropdown
                value={filterStatus}
                onOptionSelect={(e, data) => setFilterStatus(data.optionValue)}
                style={{ width: '150px' }}
              >
                <Option value="all">All</Option>
                <Option value="active">Active</Option>
                <Option value="deactivated">Deactivated</Option>
              </Dropdown>
            </div>
          </div>

          <VerticalSpace2 />

          <div className="users-table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Jobs</TableCell>
                  <TableCell>Manager</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Text>No users found.</Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="user-cell">
                          {user.profilePicture ? (
                            <Image
                              src={user.profilePicture}
                              width={32}
                              height={32}
                              shape="circular"
                              style={{ marginRight: '8px' }}
                            />
                          ) : (
                            <Person24Regular style={{ marginRight: '8px' }} />
                          )}
                          <Text weight="medium">{user.username || '-'}</Text>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Text size={200}>{user.email || '-'}</Text>
                      </TableCell>
                      <TableCell>
                        <Text size={200}>{getCompanyName(user.companyId)}</Text>
                      </TableCell>
                      <TableCell>
                        <div className="jobs-cell">
                          {getJobNames(user.jobs).length > 0 ? (
                            getJobNames(user.jobs).map((jobName, idx) => (
                              <Badge
                                key={idx}
                                appearance="filled"
                                color="brand"
                                size="small"
                                style={{ marginRight: '4px' }}
                              >
                                {jobName}
                              </Badge>
                            ))
                          ) : (
                            <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
                              No jobs
                            </Text>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.isManager ? (
                          <Badge appearance="filled" color="brand" size="small">
                            Manager
                          </Badge>
                        ) : (
                          <Text size={200}>-</Text>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="switch-container">
                          <Switch
                            checked={!user.isDeactivated}
                            onChange={() => handleToggleDeactivated(user)}
                          />
                          <Text size={200} className="switch-label">
                            {user.isDeactivated ? 'Inactive' : 'Active'}
                          </Text>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          appearance="subtle"
                          icon={<Edit24Regular />}
                          onClick={() => {
                            setSelectedUser(user);
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

        <CreateUserDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSave={handleCreateUser}
          companies={companies}
          jobs={jobs}
          currentCompanyId={currentCompanyId}
        />

        {selectedUser && (
          <EditUserDialog
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) {
                setSelectedUser(null);
              }
            }}
            user={selectedUser}
            onSave={(data) => {
              handleUpdateUser(selectedUser.id, data);
              setEditDialogOpen(false);
              setSelectedUser(null);
            }}
            companies={companies}
            jobs={jobs}
          />
        )}
      </div>
    </>
  );
}

/**
 * Dialog for creating a new user
 */
function CreateUserDialog({
  open,
  onOpenChange,
  onSave,
  companies,
  jobs,
  currentCompanyId,
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState(currentCompanyId || '');
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [isManager, setIsManager] = useState(false);
  const [canSwitchCompany, setCanSwitchCompany] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!username.trim()) {
      return;
    }
    if (!password.trim() || password.length < 6) {
      return;
    }
    if (!companyId) {
      return;
    }

    setSaving(true);
    const success = await onSave({
      username: username.trim(),
      password: password.trim(),
      companyId,
      jobs: selectedJobs,
      isManager,
      canSwitchCompany,
    });

    if (success) {
      setUsername('');
      setPassword('');
      setCompanyId(currentCompanyId || '');
      setSelectedJobs([]);
      setIsManager(false);
      setCanSwitchCompany(false);
      onOpenChange(false);
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setUsername('');
    setPassword('');
    setCompanyId(currentCompanyId || '');
    setSelectedJobs([]);
    setIsManager(false);
    setCanSwitchCompany(false);
    onOpenChange(false);
  };

  const toggleJob = (jobId) => {
    if (selectedJobs.includes(jobId)) {
      setSelectedJobs(selectedJobs.filter((id) => id !== jobId));
    } else {
      setSelectedJobs([...selectedJobs, jobId]);
    }
  };

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Create New User</DialogTitle>
          <DialogContent>
            <div className="user-form">
              <div className="form-field">
                <Label htmlFor="create-username" required>
                  Username
                </Label>
                <Input
                  id="create-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username (email will be username@gmail.com)"
                  required
                />
              </div>

              <div className="form-field">
                <Label htmlFor="create-password" required>
                  Password
                </Label>
                <Input
                  id="create-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                />
              </div>

              <div className="form-field">
                <Label htmlFor="create-company" required>
                  Company
                </Label>
                <Dropdown
                  id="create-company"
                  value={companyId}
                  onOptionSelect={(e, data) => setCompanyId(data.optionValue)}
                  placeholder="Select company"
                >
                  {companies.map((company) => (
                    <Option key={company.id} value={company.id}>
                      {company.name}
                    </Option>
                  ))}
                </Dropdown>
              </div>

              <div className="form-field">
                <Label>Jobs</Label>
                <div className="jobs-checkbox-group">
                  {jobs.map((job) => (
                    <div key={job.id} className="job-checkbox-item">
                      <Checkbox
                        checked={selectedJobs.includes(job.id)}
                        onChange={() => toggleJob(job.id)}
                        label={job.name || job.id}
                      />
                    </div>
                  ))}
                  {jobs.length === 0 && (
                    <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
                      No jobs available
                    </Text>
                  )}
                </div>
              </div>

              <div className="form-field">
                <div className="switch-container">
                  <Switch
                    checked={isManager}
                    onChange={(e, data) => setIsManager(data.checked)}
                  />
                  <Label htmlFor="create-manager">Manager</Label>
                </div>
                <small className="form-hint">
                  Managers have elevated permissions
                </small>
              </div>

              <div className="form-field">
                <div className="switch-container">
                  <Switch
                    checked={canSwitchCompany}
                    onChange={(e, data) => setCanSwitchCompany(data.checked)}
                  />
                  <Label htmlFor="create-switch-company">
                    Can Switch Company
                  </Label>
                </div>
                <small className="form-hint">
                  Allow user to switch between companies (Owner only)
                </small>
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            </DialogTrigger>
            <Button
              appearance="primary"
              onClick={handleSave}
              disabled={saving || !username.trim() || !password.trim() || !companyId}
            >
              {saving ? 'Creating...' : 'Create User'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/**
 * Dialog for editing an existing user
 */
function EditUserDialog({
  open,
  onOpenChange,
  user,
  onSave,
  companies,
  jobs,
}) {
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [companyId, setCompanyId] = useState(user?.companyId || '');
  const [selectedJobs, setSelectedJobs] = useState(user?.jobs || []);
  const [isManager, setIsManager] = useState(user?.isManager || false);
  const [canSwitchCompany, setCanSwitchCompany] =
    useState(user?.canSwitchCompany || false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
      setCompanyId(user.companyId || '');
      setSelectedJobs(user.jobs || []);
      setIsManager(user.isManager || false);
      setCanSwitchCompany(user.canSwitchCompany || false);
    }
  }, [user, open]);

  const handleSave = async () => {
    if (!username.trim()) {
      return;
    }
    if (!companyId) {
      return;
    }

    setSaving(true);
    const success = await onSave({
      username: username.trim(),
      email: email.trim(),
      companyId,
      jobs: selectedJobs,
      isManager,
      canSwitchCompany,
    });

    if (success) {
      onOpenChange(false);
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setUsername(user?.username || '');
    setEmail(user?.email || '');
    setCompanyId(user?.companyId || '');
    setSelectedJobs(user?.jobs || []);
    setIsManager(user?.isManager || false);
    setCanSwitchCompany(user?.canSwitchCompany || false);
    onOpenChange(false);
  };

  const toggleJob = (jobId) => {
    if (selectedJobs.includes(jobId)) {
      setSelectedJobs(selectedJobs.filter((id) => id !== jobId));
    } else {
      setSelectedJobs([...selectedJobs, jobId]);
    }
  };

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Edit User</DialogTitle>
          <DialogContent>
            <div className="user-form">
              <div className="form-field">
                <Label htmlFor="edit-username" required>
                  Username
                </Label>
                <Input
                  id="edit-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                />
              </div>

              <div className="form-field">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  readOnly
                />
                <small className="form-hint">Email cannot be changed</small>
              </div>

              <div className="form-field">
                <Label htmlFor="edit-company" required>
                  Company
                </Label>
                <Dropdown
                  id="edit-company"
                  value={companyId}
                  onOptionSelect={(e, data) => setCompanyId(data.optionValue)}
                  placeholder="Select company"
                >
                  {companies.map((company) => (
                    <Option key={company.id} value={company.id}>
                      {company.name}
                    </Option>
                  ))}
                </Dropdown>
              </div>

              <div className="form-field">
                <Label>Jobs</Label>
                <div className="jobs-checkbox-group">
                  {jobs.map((job) => (
                    <div key={job.id} className="job-checkbox-item">
                      <Checkbox
                        checked={selectedJobs.includes(job.id)}
                        onChange={() => toggleJob(job.id)}
                        label={job.name || job.id}
                      />
                    </div>
                  ))}
                  {jobs.length === 0 && (
                    <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
                      No jobs available
                    </Text>
                  )}
                </div>
              </div>

              <div className="form-field">
                <div className="switch-container">
                  <Switch
                    checked={isManager}
                    onChange={(e, data) => setIsManager(data.checked)}
                  />
                  <Label htmlFor="edit-manager">Manager</Label>
                </div>
                <small className="form-hint">
                  Managers have elevated permissions
                </small>
              </div>

              <div className="form-field">
                <div className="switch-container">
                  <Switch
                    checked={canSwitchCompany}
                    onChange={(e, data) => setCanSwitchCompany(data.checked)}
                  />
                  <Label htmlFor="edit-switch-company">
                    Can Switch Company
                  </Label>
                </div>
                <small className="form-hint">
                  Allow user to switch between companies (Owner only)
                </small>
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            </DialogTrigger>
            <Button
              appearance="primary"
              onClick={handleSave}
              disabled={saving || !username.trim() || !companyId}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
