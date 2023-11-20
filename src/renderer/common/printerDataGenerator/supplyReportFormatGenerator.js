import _ from 'lodash';
import globalUtils from '../../services/globalUtils';

export default (data) => {
  const commands = [];
  commands.push({
    type: 'text',
    value: `Supply Report`,
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
    value: `Supplyman: ${data.supplyman}`,
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

  data.bills.forEach((item) => {
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
    commands.push({
      type: 'text',
      style: {
        fontSize: '12px',
        fontFamily: 'Arial',
      },
      value: `${
        item.party.area?.toUpperCase() || ''
      } : ${globalUtils.getCurrencyFormat(item.orderAmount)}`,
    });
    commands.push({
      type: 'text',
      style: {
        fontSize: '14px',
        fontFamily: 'Arial',
        paddingBottom: '5px',
        borderBottom: '1px solid #000',
      },
      value: item.bags
        ?.filter((x) => x.quantity > 0)
        .map((x) => `${x.bagType}-${x.quantity}  `)
        .join(','),
    });
  });

  if (data.oldBills?.length) {
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
  }
  data.oldBills.forEach((item) => {
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
    commands.push({
      type: 'text',
      style: {
        fontSize: '12px',
        fontFamily: 'Arial',
      },
      value: `${
        item.party.area?.toUpperCase() || ''
      } : ${globalUtils.getCurrencyFormat(item.orderAmount)}`,
    });
  });
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
