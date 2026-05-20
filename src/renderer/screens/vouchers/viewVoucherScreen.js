import { Button, Divider, Image } from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import numWords from 'num-words';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthUser } from '../../contexts/allUsersContext';
import { useCompany } from '../../contexts/companyContext';
import { firebaseDB } from '../../firebaseInit';
import globalUtils from '../../services/globalUtils';
import Logo from '../../assets/images/logo.png';

export default function ViewVoucherScreen() {
  const { state } = useLocation();
  const { voucherData } = state;
  const { allUsers } = useAuthUser();
  const { currentCompanyId } = useCompany();
  const [companyDetails, setCompanyDetails] = useState(null);

  useEffect(() => {
    document.getElementsByTagName('html')[0].style.overflow = 'hidden';

    return () => {
      document.getElementsByTagName('html')[0].style.overflow = 'visible';
    };
  }, []);

  useEffect(() => {
    const fetchCompanyDetails = async () => {
      if (!currentCompanyId) return;
      try {
        const companyDocRef = doc(firebaseDB, 'companies', currentCompanyId);
        const companyDocSnap = await getDoc(companyDocRef);
        if (companyDocSnap.exists()) {
          setCompanyDetails(companyDocSnap.data());
        }
      } catch (error) {
        console.error('Error fetching company details:', error);
      }
    };

    fetchCompanyDetails();
  }, [currentCompanyId]);

  const companyName = companyDetails?.name || 'Ashish Drug Agencies';
  const companyAddress = companyDetails?.address
    || `D-45,46 DSIIDC Complex, Kalyan Puri, New Delhi, 110091
Ph.01121203409, 9971076796,8448291560, 8448291557,
ashishdrugagencies@gmail.com`;
  const companyLogo = companyDetails?.logoUrl || Logo;

  return (
    <div className="view-voucher-container">
      <div className="voucher-border">
        <Image style={{ position: 'absolute' }} width={100} src={companyLogo} />
        <center>
          <p className="created-by">
            
            Voucher Created By:{' '}
            {allUsers.find((x) => x.uid === voucherData.requesterId)?.username || '--'}
          </p>
          <h1>{companyName}</h1>
          <p style={{ whiteSpace: 'pre-line' }}>{companyAddress}</p>

          <Divider />
          <h2>Expense Voucher: {voucherData.receiptNumber}</h2>
          <div className="voucher-detail-row date-row">
            <div className="voucher-value">
              Date: {globalUtils.getTimeFormat(voucherData.timestamp, true)}
            </div>
          </div>
        </center>
        <div className="voucher-details">
          <div className="voucher-detail-row">
            <div className="voucher-key">Name of the receiver:</div>
            <div className="voucher-value">
              {allUsers.find((x) => x.uid === voucherData.employeeId)?.username || '--'}
            </div>
          </div>
          <div className="voucher-detail-row">
            <div className="voucher-key">On Account of:</div>{' '}
            <div className="voucher-value" />
            {voucherData.type}
          </div>
        </div>
        <div className="voucher-detail-row">
          <div className="voucher-key">Payment Method:</div>
          <div className="voucher-value">Cash</div>
        </div>

        <div className="voucher-detail-row">
          <div className="voucher-key">Narration:</div>
          <div className="voucher-value"> {voucherData.narration}</div>
        </div>
        <div className="voucher-detail-row">
          <div className="voucher-key">Amount:</div>{' '}
          <div className="voucher-value">
            {globalUtils.getCurrencyFormat(voucherData.amount)}
          </div>
        </div>
        <div className="voucher-detail-row">
          <div className="voucher-key">Amount in words:</div>{' '}
          <div className="voucher-value">
            {' '}
            {numWords(voucherData.amount).toUpperCase()} RUPEES ONLY
          </div>
        </div>
        <div className="signatures">
          <div>Received By</div>
          <div>Paid By</div>
          <div>Authorized By</div>
        </div>
        <center className="no-print">
          <div>Receipt Images</div>
          {voucherData.images?.map((x) => {
            return (
              <Image width={200} src={x} style={{ marginRight: '10px' }} />
            );
          })}
        </center>
      </div>
      <div className="no-print">
        <Button
          onClick={() => {
            window.print();
          }}
        >
          Print
        </Button>
      </div>
    </div>
  );
}
