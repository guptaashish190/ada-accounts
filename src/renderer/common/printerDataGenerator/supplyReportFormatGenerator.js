/* eslint-disable no-restricted-syntax */
import _ from 'lodash';
import globalUtils from '../../services/globalUtils';

export default (data, isBundle) => {
  const commands = [];
  commands.push({
    type: 'text',
    value: isBundle ? 'Bundle' : `Supply Report`,
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
    value: `${isBundle ? 'Assigned to' : 'Supplyman'}: ${data.supplyman}`,
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
  if (!isBundle) {
    commands.push({
      type: 'text',
      value: `Cases: ${data.numCases}, Polybags: ${data.numPolybags}, Packets: ${data.numPackets}`,
      style: {
        fontSize: '12px',
        fontFamily: 'Arial',
      },
    });
  }
  if (data.bills?.length > 0) {
    commands.push({
      type: 'text',
      value: `Bills in hand`,
      style: {
        fontWeight: '700',
        textAlign: 'center',
        fontSize: '14px',
        fontFamily: 'Arial',
        marginTop: '10px',
        marginBottom: '5px',
      },
    });
  }

  data.bills?.forEach((item) => {
    commands.push({
      type: 'text',
      style: {
        fontSize: '12px',
        fontFamily: 'Arial',
        paddingTop: '5px',
      },
      value: `${_.startCase(removeSpaces(item.party.name).toLowerCase())} (${
        item.party.area?.toUpperCase() || ''
      })`,
    });
    commands.push({
      type: 'text',
      style: {
        fontSize: '12px',
        fontFamily: 'Arial',
      },
      value: `${item.billNumber}(${globalUtils.getCurrencyFormat(
        item.balance,
      )})`,
    });
    if (!isBundle) {
      commands.push({
        type: 'text',
        style: {
          fontSize: '12px',
          fontFamily: 'Arial',
          fontWeight: 'bold',
        },
        value: item.bags
          ?.filter((x) => x.quantity > 0)
          .map((x) => `${x.bagType}-${x.quantity}  `)
          .join(','),
      });
    }
    commands.push({
      type: 'text',
      style: {
        paddingBottom: '5px',
        borderBottom: '1px solid #000',
      },
      value: '',
    });
  });
  commands.push({
    type: 'text',
    value: `Old Bills in hand`,
    style: {
      fontWeight: '700',
      textAlign: 'center',
      fontSize: '14px',
      fontFamily: 'Arial',
      marginTop: '10px',
      marginBottom: '5px',
    },
  });
  if (data.oldBills?.length) {
    const groupedOrders = {};
    for (const element of data.oldBills) {
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
        value: x
          .map(
            (y) =>
              `${y.billNumber}(${globalUtils.getCurrencyFormat(y.balance)})`,
          )
          .join(' , '),
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
  return commands;
};
function removeSpaces(inputString) {
  // Use a regular expression to replace consecutive spaces with a single space
  return inputString.replace(/\s+/g, ' ');
}
