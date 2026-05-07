/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import globalUtils from '../../services/globalUtils';
import './style.css';

export default function PrintCashReceipt({ data }) {
  const companyName = data.company?.name || 'Company';
  const companyAddress = data.company?.address || '';
  const companyLogoUrl = data.company?.logoUrl || '';

  return (
    <center>
      <div className="print-area">
        {companyLogoUrl ? (
          <img
            src={companyLogoUrl}
            alt="Company logo"
            style={{ width: 80, maxHeight: 80, objectFit: 'contain' }}
          />
        ) : null}
        <h3 style={{ marginBottom: 4 }}>{companyName}</h3>
        {companyAddress ? (
          <p style={{ marginTop: 0, whiteSpace: 'pre-line' }}>{companyAddress}</p>
        ) : null}
        <h4>
          <u>Cash Receipt: {data.receiptNumber}</u>
        </h4>
        <div className="print-details">
          <div>
            <span>Name:</span>
            <span>{data.user}</span>
          </div>
          <div>
            <span>Time:</span>
            <span>{globalUtils.getTimeFormat(new Date())}</span>
          </div>
          <div>
            <span>Created By:</span>
            <span>{data.createdBy}</span>
          </div>
        </div>

        <table className="print-area-table">
          <thead>
            <tr>
              <th>Party Name</th>
              <th>Area</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items?.map((pri) => {
              return (
                <tr>
                  <td>
                    {pri.party?.name}({pri.party?.fileNumber})
                  </td>
                  <td>{pri.party?.area}</td>
                  <td>{globalUtils.getCurrencyFormat(pri.amount)}</td>
                </tr>
              );
            })}
            <tr>
              <td />
              <td>
                <b>Total</b>
              </td>
              <td>
                <b>{globalUtils.getCurrencyFormat(data.total)}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </center>
  );
}
