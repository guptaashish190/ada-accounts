import React, { useEffect, useState } from 'react';
import {
  doc,
  getDocs,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import {
  Button,
  CardHeader,
  Card,
  Toaster,
  useToastController,
  Text,
} from '@fluentui/react-components';
import { firebaseDB } from '../../firebaseInit';
import { getUsersCollection } from '../../services/firestoreHelpers';
import { showToast } from '../../common/toaster';
import SelectUserDropdown from '../../common/selectUser';
import PrinterSettings from './printers';

export default function SettingsScreen() {
  const [billWithPartyUserId, setBillWithPartyUserId] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [billWithPartySaving, setBillWithPartySaving] = useState(false);
  const toasterId = 'settings-toaster';
  const { dispatchToast } = useToastController(toasterId);


  const getBillWithPartySetting = async () => {
    const billWithPartyDoc = doc(firebaseDB, 'settings', 'billWithParty');
    onSnapshot(billWithPartyDoc, (docSnap) => {
      if (docSnap.exists()) {
        setBillWithPartyUserId(docSnap.data()?.userId || '');
      } else {
        setBillWithPartyUserId('');
      }
    });
  };

  const getAllUsers = async () => {
    const usersRef = getUsersCollection();
    const usersSnap = await getDocs(usersRef);
    const users = [];
    usersSnap.forEach((docSnap) => {
      users.push({ id: docSnap.id, ...docSnap.data() });
    });
    users.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
    setAllUsers(users);
  };

  const saveBillWithPartyUser = async () => {
    if (!billWithPartyUserId) {
      showToast(dispatchToast, 'Please select a user', 'error');
      return;
    }
    setBillWithPartySaving(true);
    try {
      const settingsDocRef = doc(firebaseDB, 'settings', 'billWithParty');
      await setDoc(
        settingsDocRef,
        {
          userId: billWithPartyUserId,
          updatedAt: Date.now(),
        },
        { merge: true },
      );
      showToast(dispatchToast, 'Bill With Party user saved', 'success');
    } catch (error) {
      console.error('Error updating Bill With Party user:', error);
      showToast(dispatchToast, 'Failed to save Bill With Party user', 'error');
    } finally {
      setBillWithPartySaving(false);
    }
  };

  useEffect(() => {
    getAllUsers();
    getBillWithPartySetting();
  }, []);

  return (
    <center>
      <Toaster toasterId={toasterId} />
      <h3>Settings</h3>
      <Card style={{ maxWidth: 500, textAlign: 'left', padding: 16 }}>
        <CardHeader header="Bill With Party Assignment" />
        <Text size={200}>
          Select the user whose UID should be used in the bill `with` field
          when accounts marks a bill as &quot;Bill With Party&quot;.
        </Text>
        <br />
        <SelectUserDropdown
          placeholder="Select user"
          user={billWithPartyUserId}
          setUser={setBillWithPartyUserId}
          valueKey="id"
          users={allUsers}
          filterDeactivated={false}
          style={{ width: '100%' }}
          showProfilePicture={false}
        />
        <br />
        <Button
          appearance="primary"
          onClick={saveBillWithPartyUser}
          disabled={!billWithPartyUserId || billWithPartySaving}
        >
          {billWithPartySaving ? 'Saving...' : 'Save Bill With Party User'}
        </Button>
      </Card>
      <br />
      <Card style={{ maxWidth: 800, textAlign: 'left', padding: 16 }}>
        <CardHeader header="Printer Settings" />
        <PrinterSettings />
      </Card>
    </center>
  );
}

