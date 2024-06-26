/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable no-restricted-syntax */
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Dropdown,
  Input,
  Option,
  Spinner,
  Text,
} from '@fluentui/react-components';
import { DatePicker } from '@fluentui/react-datepicker-compat';

import '../style.css';
import ReactToPrint, { useReactToPrint } from 'react-to-print';
import { useAuthUser } from '../../../contexts/allUsersContext';
import { firebaseDB } from '../../../firebaseInit';
import globalUtils from '../../../services/globalUtils';
import constants from '../../../constants';
import { VerticalSpace1 } from '../../../common/verticalSpace';

export default function CashReport() {
  const [cashVouchers, setCashVouchers] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [upis, setUpis] = useState([]);
  const [cheques, setCheques] = useState([]);
  const [loading, setLoading] = useState(false);

  const handlePrint = () => {
    window.electron.ipcRenderer.sendMessage('printCurrentPage');
  };
  const onSearch = async (clear) => {
    setLoading(true);
    try {
      const cashData = await getFirebaseMappedData(
        'cashReceipts',
        selectedDate,
        setCashVouchers,
      );
      await getFirebaseMappedData('upi', selectedDate, setUpis);
      await getFirebaseMappedData('cheques', selectedDate, setCheques);

      let total1 = 0;
      cashData.forEach((x) => {
        x.prItems.forEach((y) => {
          total1 += y.amount;
        });
      });
      setTotal(total1);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };
  useEffect(() => {
    onSearch(true);
  }, []);

  return (
    <center>
      <div className="print-supply-reports-container">
        <h3>
          Collection Report -{globalUtils.getTimeFormat(selectedDate, true)}
        </h3>

        <div className="all-bills-search-input-container">
          <DatePicker
            className=" filter-input"
            onSelectDate={setSelectedDate}
            placeholder="From"
            value={selectedDate}
          />

          <Button
            onClick={() => {
              onSearch();
            }}
          >
            Search
          </Button>

          <Button onClick={handlePrint}>Print</Button>
        </div>
        {loading ? (
          <Spinner />
        ) : (
          <div>
            {cashVouchers.map((sr, i) => {
              return (
                <CashReportRow
                  key={`supply-report-all-list-${sr.id}`}
                  index={i}
                  data={sr}
                />
              );
            })}
          </div>
        )}
        {!loading && cashVouchers.length === 0 ? (
          <div>No Supply Reports found</div>
        ) : null}
        <h3>Total Cash Collection - {globalUtils.getCurrencyFormat(total)}</h3>
        <table>
          <thead className="supply-report-row">
            <th>
              <Text className="sr-id">UPIs</Text>
            </th>
            <th>
              <Text>Area</Text>
            </th>
            <th>
              <Text>Amount</Text>
            </th>
            <th>
              <Text>Status</Text>
            </th>
          </thead>

          {upis.map((upi, i) => (
            <UpiRow data={upi} index={i} />
          ))}
        </table>
        <h3>
          Total UPIs -{' '}
          {globalUtils.getCurrencyFormat(
            upis.reduce((prev, cur) => prev + cur.amount, 0),
          )}
        </h3>

        <table>
          <thead className="supply-report-row">
            <th>
              <Text className="sr-id">Cheques</Text>
            </th>
            <th>
              <Text>Area</Text>
            </th>
            <th>
              <Text>Amount</Text>
            </th>
            <th>
              <Text>Cheque Date</Text>
            </th>
          </thead>

          {cheques.map((che, i) => (
            <ChequesRow data={che} index={i} />
          ))}
        </table>
        <h3>
          Total Cheques -
          {globalUtils.getCurrencyFormat(
            cheques.reduce((prev, cur) => prev + parseInt(cur.amount, 10), 0),
          )}
        </h3>
      </div>
      <VerticalSpace1 />
      <div>*** End of Report ***</div>
    </center>
  );
}

function UpiRow({ data, index }) {
  const [party, setParty] = useState();
  const [loading, setLoading] = useState(false);
  const { allUsers } = useAuthUser();
  const fetchParty = async () => {
    setLoading(true);
    try {
      const party1 = await globalUtils.fetchPartyInfo(data.partyId);

      setParty(party1);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchParty();
  }, []);

  if (loading) return <Spinner />;
  if (!party) return <div>Error loading party</div>;

  return (
    <tr>
      <td>{party.name}</td>
      <td>{party.area}</td>
      <td>{globalUtils.getCurrencyFormat(data.amount)}</td>
      <td>{data.isReceived ? 'Received' : 'Not Received'} </td>
    </tr>
  );
}

function ChequesRow({ data, index }) {
  const [party, setParty] = useState();
  const [loading, setLoading] = useState(false);
  const { allUsers } = useAuthUser();
  const fetchParty = async () => {
    setLoading(true);
    try {
      const party1 = await globalUtils.fetchPartyInfo(data.partyId);

      setParty(party1);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchParty();
  }, []);

  if (loading) return <Spinner />;
  if (!party) return <div>Error loading party</div>;

  return (
    <tr>
      <td>{party.name}</td>
      <td>{party.area}</td>
      <td>{globalUtils.getCurrencyFormat(data.amount)}</td>
      <td>{globalUtils.getTimeFormat(data.chequeDate, true)} </td>
    </tr>
  );
}

function CashReportRow({ data, index }) {
  const navigate = useNavigate();

  const { allUsers } = useAuthUser();
  return (
    <table>
      <thead className="supply-report-row">
        <th>
          <Text className="sr-id">{data.cashReceiptNumber}</Text>
        </th>
        <th>
          <Text>Area</Text>
        </th>
        <th>
          <Text className="sr-id">
            {allUsers.find((x) => x.uid === data.paymentFromUserId)?.username}
          </Text>
        </th>

        <th>
          <Text className="sr-supplyman">
            {globalUtils.getDayTime(data.timestamp)}
          </Text>
        </th>
      </thead>

      {data.prItems.map((x) => (
        <SupplyReportOrderRow prItem={x} />
      ))}
      <tr>
        <td />
        <td />
        <td>
          <b>Total Amount</b>
        </td>
        <td>
          <b>
            {globalUtils.getCurrencyFormat(
              data.prItems.reduce((acc, cur) => acc + cur.amount, 0),
            )}
          </b>
        </td>
      </tr>
    </table>
  );
}

function SupplyReportOrderRow({ prItem }) {
  const [party, setParty] = useState();
  const [loading, setLoading] = useState(false);
  const { allUsers } = useAuthUser();
  const fetchParty = async () => {
    setLoading(true);
    try {
      const party1 = await globalUtils.fetchPartyInfo(prItem.partyId);

      setParty(party1);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchParty();
  }, []);

  if (loading) return <Spinner />;
  if (!party) return <div>Error loading party</div>;

  return (
    <tbody className="supply-report-print-bill-detail">
      <td style={{ width: '20%' }}>{party.name}</td>
      <td style={{ width: '10%' }}>{party.area}</td>
      <td style={{ width: '5%' }}>{party.fileNumber}</td>
      <td style={{ width: '10%' }}>
        {globalUtils.getCurrencyFormat(prItem.amount)}
      </td>
    </tbody>
  );
}

const getFirebaseMappedData = async (refName, selectedDate, setList) => {
  let refMain = collection(firebaseDB, refName);

  const dateFrom = new Date(selectedDate);
  dateFrom.setHours(0);
  dateFrom.setMinutes(0);
  dateFrom.setSeconds(1);
  const dateTo = new Date(selectedDate);
  dateTo.setHours(23);
  dateTo.setMinutes(59);
  dateTo.setSeconds(59);

  refMain = query(
    refMain,
    where('timestamp', '>=', dateFrom.getTime()),
    where('timestamp', '<=', dateTo.getTime()),
  );

  const querySnapshot = await getDocs(refMain);

  let mainData = querySnapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
  }));
  mainData = mainData.filter((x) => x.status !== 'CANCELLED');
  mainData = mainData.sort((rd1, rd2) => rd1.timestamp - rd2.timestamp);

  setList(mainData);
  return mainData;
};
