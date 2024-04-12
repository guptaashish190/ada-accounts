import { Button, Divider, Image } from '@fluentui/react-components';
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import numWords from 'num-words';
import { useAuthUser } from '../../contexts/allUsersContext';
import globalUtils from '../../services/globalUtils';
import Logo from '../../assets/images/logo.png';

export default function ViewVoucherScreen() {
  const { state } = useLocation();
  const { voucherData } = state;
  const { allUsers } = useAuthUser();

  useEffect(() => {
    document.getElementsByTagName('html')[0].style.overflow = 'hidden';

    return () => {
      document.getElementsByTagName('html')[0].style.overflow = 'visible';
    };
  }, []);

  return (
    <div className="view-voucher-container">
      <div className="voucher-border">
        <Image style={{ position: 'absolute' }} width={100} src={Logo} />
        <center>
          <p className="created-by">
            Voucher Created By:{' '}
            {allUsers.find((x) => x.uid === voucherData.requesterId).username}
          </p>
          <h1>Ashish Drug Agencies</h1>
          <p>
            D-45,46 DSIIDC Complex, Kalyan Puri, New Delhi, 110091
            <br />
            Ph.01121203409, 9971076796,8448291560, 8448291557,
            ashishdrugagencies@gmail.com
            <br />
          </p>

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
              {allUsers.find((x) => x.uid === voucherData.employeeId).username}
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
