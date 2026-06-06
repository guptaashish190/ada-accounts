/* eslint-disable no-restricted-syntax */
import _ from 'lodash';
import globalUtils from '../../services/globalUtils';
import {
  filterBillsForBundlePrint,
  getPrintBalance,
} from '../../services/handoverBalanceUtils';
import { pushNoteLineIfPresent } from './printerFormatHelpers';

const titleStyle = {
  fontWeight: '700',
  textAlign: 'center',
  fontSize: '18px',
  fontFamily: 'Arial',
};

const receiptNumberStyle = {
  fontWeight: '700',
  textAlign: 'center',
  fontSize: '16px',
  fontFamily: 'Arial',
  marginBottom: '20px',
};

const bodyTextStyle = {
  fontSize: '12px',
  fontFamily: 'Arial',
};

const sectionHeaderStyle = {
  fontWeight: '700',
  textAlign: 'center',
  fontSize: '14px',
  fontFamily: 'Arial',
  marginTop: '10px',
  marginBottom: '5px',
};

function removeSpaces(inputString) {
  return inputString.replace(/\s+/g, ' ');
}

const appendDivider = (commands) => {
  commands.push({
    type: 'text',
    style: {
      margin: '5px',
      borderBottom: '1px solid #000',
    },
    value: '',
  });
};

const appendGroupedOldBills = (commands, bills, isBundle) => {
  const billsForPrint = isBundle
    ? filterBillsForBundlePrint(bills)
    : bills || [];
  if (!billsForPrint.length) return;

  const groupedOrders = {};
  for (const element of billsForPrint) {
    if (groupedOrders[element.partyId] !== undefined) {
      groupedOrders[element.partyId] = [
        ...groupedOrders[element.partyId],
        element,
      ];
    } else {
      groupedOrders[element.partyId] = [element];
    }
  }

  Object.values(groupedOrders).forEach((partyBills) => {
    commands.push({
      type: 'text',
      style: {
        fontSize: '11px',
        fontFamily: 'Arial',
        paddingTop: '5px',
        fontWeight: 'bold',
      },
      value: `${_.startCase(partyBills[0].party.name.toLowerCase())}`,
    });
    commands.push({
      type: 'text',
      style: {
        fontSize: '11px',
        fontFamily: 'Arial',
        paddingTop: '5px',
      },
      value: partyBills
        .map(
          (bill) =>
            `${bill.billNumber}(${globalUtils.getCurrencyFormat(getPrintBalance(bill, isBundle))})`,
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
};

const appendBundleSection = (commands, data) => {
  const bundleBills = data.bundle?.bills || [];
  if (!bundleBills.length) return;

  appendDivider(commands);
  commands.push({
    type: 'text',
    value: `${data.bundle.receiptNumber}`,
    style: sectionHeaderStyle,
  });
  commands.push({
    type: 'text',
    value: 'Old bills in hand',
    style: bodyTextStyle,
  });
  appendGroupedOldBills(commands, bundleBills, true);
};

export default (data, isBundle) => {
  const billsForPrint = isBundle
    ? filterBillsForBundlePrint(data.bills)
    : data.bills || [];
  const oldBillsForPrint = isBundle
    ? filterBillsForBundlePrint(data.oldBills)
    : data.oldBills || [];

  const commands = [];
  commands.push({
    type: 'text',
    value: isBundle ? 'Bundle' : 'Supply Report',
    style: titleStyle,
  });
  commands.push({
    type: 'text',
    value: `${data.receiptNumber}`,
    style: receiptNumberStyle,
  });
  commands.push({
    type: 'text',
    value: `${isBundle ? 'Assigned to' : 'Supplyman'}: ${data.supplyman}`,
    style: bodyTextStyle,
  });
  commands.push({
    type: 'text',
    value: `Dispatch Time: ${data.dispatchTime}`,
    style: bodyTextStyle,
  });
  if (!isBundle) {
    commands.push({
      type: 'text',
      value: `Cases: ${data.numCases}, Polybags: ${data.numPolybags}, Packets: ${data.numPackets}`,
      style: bodyTextStyle,
    });
  }
  appendDivider(commands);

  const noteLineStyle = bodyTextStyle;
  pushNoteLineIfPresent(commands, 'Dispatch Notes', data.dispatchNotes, noteLineStyle);
  pushNoteLineIfPresent(
    commands,
    'Account Notes',
    data.accountDispatchNotes,
    noteLineStyle,
  );

  if (billsForPrint.length > 0) {
    commands.push({
      type: 'text',
      value: 'Bills in hand',
      style: sectionHeaderStyle,
    });
  }

  billsForPrint.forEach((item) => {
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
      style: bodyTextStyle,
      value: `${item.billNumber}(${globalUtils.getCurrencyFormat(
        getPrintBalance(item, isBundle),
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

  if (oldBillsForPrint.length > 0) {
    appendGroupedOldBills(commands, data.oldBills, isBundle);
  }

  if (!isBundle) {
    appendBundleSection(commands, data);
  }

  commands.push({
    type: 'text',
    value: '',
    style: { fontSize: '12px', fontFamily: 'Arial', marginTop: '20px' },
  });

  if (data.includeBarcode !== false) {
    commands.push({
      type: 'barCode',
      value: data.receiptNumber,
      height: 40,
      width: 2,
      displayValue: false,
      fontsize: 12,
    });
  }

  return commands;
};
