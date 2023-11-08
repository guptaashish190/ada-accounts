import _ from 'lodash';
import globalUtils from '../services/globalUtils';

export default {
  generatePrinterCommand: (data) => {
    const commands = [];
    commands.push({
      type: 'text',
      value: `Cash Receipt`,
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
      value: `Name: ${data.user}`,
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
      value: '-------------------------------------',
      style: {
        fontSize: '12px',
        fontFamily: 'Arial',
      },
    });

    data.items.forEach((item) => {
      commands.push({
        type: 'text',
        style: { fontSize: '12px', fontFamily: 'Arial' },
        value: `${_.startCase(item.party.name.toLowerCase())} ${_.capitalize(
          item.party.area,
        )} - ${globalUtils.getCurrencyFormat(item.amount)}`,
      });

      commands.push({
        type: 'text',
        value: '-----------------------------------',
        style: { fontSize: '12px', fontFamily: 'Arial' },
      });
    });

    commands.push({
      type: 'text',
      value: `Total: ${globalUtils.getCurrencyFormat(data.total)}`,
      style: {
        fontWeight: 'bold',
        fontSize: '16px',
        fontFamily: 'Arial',
        marginTop: '20px',
        marginBottom: '20px',
      },
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
      value: `Created By: ${data.createdBy}`,
      style: {
        marginTop: '10px',
        fontSize: '10px',
        textAlign: 'center',
        fontFamily: 'Arial',
      },
    });
    return commands;
  },
};
