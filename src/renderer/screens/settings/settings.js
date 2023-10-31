import React, { useEffect, useState } from 'react';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Input,
  CardHeader,
  Card,
} from '@fluentui/react-components';
import { firebaseDB } from '../../firebaseInit';

export default function SettingsScreen() {
  const [fileNumbers, setFileNumbers] = useState([]);

  const getFileNumbers = async () => {
    const settingsCollection = collection(firebaseDB, 'settings');
    const fileNumbersDoc = doc(firebaseDB, 'settings', 'fileNumbers');

    const unsubscribe = onSnapshot(fileNumbersDoc, (doc1) => {
      if (doc1.exists()) {
        const data = doc1.data();
        setFileNumbers(data.data);
        // Perform actions with the data as it changes
      } else {
        console.log('Document does not exist');
      }
    });
  };

  useEffect(() => {
    getFileNumbers();
  }, []);

  return (
    <center>
      <h3>Settings</h3>
      <Card>
        <CardHeader>File Numbers</CardHeader>
        {fileNumbers.map((fn, index) => {
          return <div key={`fn-item-${fn}`}>{fn}</div>;
        })}
      </Card>
      <AddFileNumberDialog />
    </center>
  );
}

function AddFileNumberDialog() {
  const [file, setFile] = useState('');
  const [open, setOpen] = useState(false);

  const onAdd = async () => {
    const settingsDocRef = doc(firebaseDB, 'settings', 'fileNumbers');
    try {
      updateDoc(settingsDocRef, {
        data: arrayUnion(file),
      });
      console.log('Document updated successfully.');
      setOpen(false);
    } catch (error) {
      console.error('Error updating document:', error);
    }
  };

  return (
    <Dialog open={open}>
      <DialogTrigger disableButtonEnhancement>
        <Button onClick={() => setOpen(true)}>Add</Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Add File Number</DialogTitle>
          <DialogContent>
            <Input
              value={file}
              onChange={(e) => setFile(e.target.value)}
              placeholder="File Number"
            />
          </DialogContent>
          <DialogActions>
            <DialogTrigger>
              <Button appearance="primary" onClick={() => onAdd()}>
                Add
              </Button>
            </DialogTrigger>
            <DialogTrigger disableButtonEnhancement>
              <Button onClick={() => setOpen(false)} appearance="secondary">
                Close
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
