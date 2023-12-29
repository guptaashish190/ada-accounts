import _ from 'lodash';
import globalUtils from '../../services/globalUtils';

export default (data) => {
  const commands = [];
  commands.push({
    type: 'text',
    value: `Voucher`,
    style: {
      marginTop: '10px',
      marginBottom: '5px',
      fontSize: '10px',
      textAlign: 'center',
      fontFamily: 'Arial',
    },
  });
  commands.push({
    type: 'text',
    value: data.voucher.receiptNumber,
    style: {
      fontWeight: '700',
      textAlign: 'center',
      fontSize: '16px',
      marginBottom: '5px',
      fontFamily: 'Arial',
    },
  });
  commands.push({
    type: 'text',
    value: `-----------`,
    style: {
      textAlign: 'center',
    },
  });
  commands.push({
    type: 'text',
    value: data.voucher.type,
    style: {
      fontWeight: '700',
      textAlign: 'center',
      fontSize: '16px',

      fontFamily: 'Arial',
    },
  });
  commands.push({
    type: 'text',
    value: `-----------`,
    style: {
      textAlign: 'center',
    },
  });
  // commands.push({
  //   type: 'text',
  //   value: `${data.receiptNumber}`,
  //   style: {
  //     fontWeight: '700',
  //     textAlign: 'center',
  //     fontSize: '16px',
  //     fontFamily: 'Arial',
  //     marginBottom: '20px',
  //   },
  // });
  commands.push({
    type: 'text',
    value: `Name: ${data.username}`,
    style: {
      fontSize: '12px',
      fontFamily: 'Arial',
    },
  });
  commands.push({
    type: 'text',
    value: `Time: ${data.time}`,
    style: { fontSize: '12px', fontFamily: 'Arial' },
  });

  commands.push({
    type: 'text',
    value: `Narration: ${data.voucher.narration}`,
    style: { fontSize: '12px', fontFamily: 'Arial' },
  });

  commands.push({
    type: 'text',
    value: `${globalUtils.getCurrencyFormat(data.voucher.amount)}`,
    style: {
      fontWeight: 'bold',
      fontSize: '22px',
      fontFamily: 'Arial',
      textAlign: 'center',
      marginTop: '20px',
      marginBottom: '20px',
    },
  });
  // commands.push({
  //   type: 'barCode',
  //   value: data.receiptNumber,
  //   height: 40, // height of barcode, applicable only to bar and QR codes
  //   width: 2, // width of barcode, applicable only to bar and QR codes
  //   displayValue: false, // Display value below barcode
  //   fontsize: 12,
  // });
  commands.push({
    type: 'text',
    value: `Created By: ${data.createdBy}`,
    style: {
      marginTop: '10px',
      fontSize: '10px',
      textAlign: 'center',
      fontFamily: 'Arial',
    },
  });
  return commands;
};
