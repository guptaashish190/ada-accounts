/* eslint-disable no-restricted-syntax */
import _ from 'lodash';
import globalUtils from '../../services/globalUtils';

export default (data, isBundle) => {
  const commands = [];
  commands.push({
    type: 'text',
    value: `Bill Receiving`,
    style: {
      fontWeight: '700',
      textAlign: 'center',
      fontSize: '18px',
      fontFamily: 'Arial',
    },
  });
  commands.push({
    type: 'text',
    value: `${data.receiptNumber}`,
    style: {
      fontWeight: '700',
      textAlign: 'center',
      fontSize: '16px',
      fontFamily: 'Arial',
      marginBottom: '20px',
    },
  });
  commands.push({
    type: 'text',
    value: `${isBundle ? 'Received from' : 'Supplyman'}: ${data.supplyman}`,
    style: {
      fontSize: '12px',
      fontFamily: 'Arial',
    },
  });
  commands.push({
    type: 'text',
    value: `Dispatch Time: ${data.dispatchTime}`,
    style: {
      fontSize: '12px',
      fontFamily: 'Arial',
    },
  });

  commands.push({
    type: 'text',
    value: `Received Bills`,
    style: {
      fontWeight: '700',
      textAlign: 'center',
      fontSize: '14px',
      fontFamily: 'Arial',
      marginBottom: '20px',
    },
  });

  const groupedOrders = {};
  for (const element of data.bills) {
    if (groupedOrders[element.partyId] !== undefined) {
      groupedOrders[element.partyId] = [
        ...groupedOrders[element.partyId],
        element,
      ];
    } else {
      groupedOrders[element.partyId] = [element];
    }
  }
  Object.values(groupedOrders).forEach((x) => {
    commands.push({
      type: 'text',
      style: {
        fontSize: '11px',
        fontFamily: 'Arial',
        paddingTop: '5px',
        fontWeight: 'bold',
      },
      value: `${_.startCase(x[0].party.name.toLowerCase())}`,
    });
    commands.push({
      type: 'text',
      style: {
        fontSize: '11px',
        fontFamily: 'Arial',
        paddingTop: '5px',
      },
      value: x.map((y) => `${y.billNumber}`).join(' , '),
    });
    commands.push({
      type: 'text',
      style: {
        borderBottom: '1px solid #000',
        paddingBottom: '5px',
      },
      value: '',
    });
  });

  if (data.otherAdjustedBills && data.otherAdjustedBills.length) {
    // Other Adjusted Bills
    commands.push({
      type: 'text',
      value: `Other Adjusted Payments`,
      style: {
        fontWeight: '700',
        textAlign: 'center',
        fontSize: '14px',
        fontFamily: 'Arial',
        marginBottom: '5px',
        marginTop: '5px',
      },
    });
    data.otherAdjustedBills.forEach((item) => {
      commands.push({
        type: 'text',
        style: {
          fontSize: '12px',
          fontFamily: 'Arial',
          paddingTop: '5px',
          fontWeight: 'bold',
        },
        value: item.billNumber,
      });
      commands.push({
        type: 'text',
        style: {
          fontSize: '12px',
          fontFamily: 'Arial',
        },
        value: `${_.startCase(item.party.name.toLowerCase())}`,
      });
    });
  }
  if (data.returnedGoods && data.returnedGoods.length) {
    // Returned Goods
    commands.push({
      type: 'text',
      value: `Returned Goods`,
      style: {
        fontWeight: '700',
        textAlign: 'center',
        fontSize: '14px',
        fontFamily: 'Arial',
        marginBottom: '5px',
        marginTop: '5px',
      },
    });

    data.returnedGoods.forEach((item) => {
      commands.push({
        type: 'text',
        style: {
          fontSize: '12px',
          fontFamily: 'Arial',
          padding: '5px 0',
          borderBottom: '1px solid #000',
        },
        value: `${item.billNumber} ${_.startCase(
          item.party.name.toLowerCase(),
        )} ${_.capitalize(item.party.area)}`,
      });
    });
  }

  commands.push({
    type: 'text',
    value: '',
    style: { fontSize: '12px', fontFamily: 'Arial', marginTop: '20px' },
  });
  commands.push({
    type: 'barCode',
    value: data.receiptNumber,
    height: 40, // height of barcode, applicable only to bar and QR codes
    width: 2, // width of barcode, applicable only to bar and QR codes
    displayValue: false, // Display value below barcode
    fontsize: 12,
  });
  commands.push({
    type: 'text',
    value: `Received By: ${data.receivedBy}`,
    style: {
      marginTop: '10px',
      fontSize: '10px',
      textAlign: 'center',
      fontFamily: 'Arial',
    },
  });
  return commands;
};
