import { collection, getDocs, limit, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Card, Spinner } from '@fluentui/react-components';
import { useNavigate } from 'react-router-dom';
import { firebaseDB } from '../../../firebaseInit';
import './style.css';
import PartySelector from '../../../common/partySelector';
import { VerticalSpace1 } from '../../../common/verticalSpace';

export default function PartyListScreen() {
  const [parties, setParties] = useState([]);
  const [defaultParties, setDefaultParties] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPartyDetails = async () => {
      try {
        setLoading(true);
        const partiesCollection = collection(firebaseDB, 'parties');
        const partiesQuery = query(partiesCollection, limit(50));
        const querySnapshot = await getDocs(partiesQuery);

        const partyData = [];

        querySnapshot.forEach((doc) => {
          partyData.push(doc.data());
        });
        console.log(partyData);
        setParties(partyData);
        setDefaultParties(partyData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching party details:', error);
        setLoading(false);
      }
    };

    fetchPartyDetails();
  }, []);

  if (loading) return <Spinner />;
  return (
    <center className="settings-party-list-container">
      <h3>Party Details</h3>
      <PartySelector
        onPartySelected={(p) => {
          if (!p) {
            setParties(defaultParties);
          } else {
            setParties([p]);
          }
        }}
      />
      <VerticalSpace1 />
      <table>
        <tr>
          <th>Name</th>
          <th>Area</th>
          <th>PIN</th>
          <th>Address</th>
          <th>File Number</th>
        </tr>

        {parties.map((party) => (
          <tr
            onClick={() => {
              navigate('/partyDetails', {
                state: {
                  partyId: party.id,
                },
              });
            }}
          >
            <td>{party.name}</td>
            <td>{party.area || '--'}</td>
            <td>{party.pin || '--'}</td>
            <td>{party.addressline1 || '--'}</td>
            <td>{party.fileNumber || '--'}</td>
          </tr>
        ))}
      </table>
    </center>
  );
}
