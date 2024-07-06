import globalUtils from '../../../services/globalUtils';

// return true if party is defaulter
export default (upis, cheques, cash, lastPayment, bill) => {
  console.log(bill.party.paymentTerms);
  const totalCurUpiPayment = upis.reduce(
    (acc, current) => acc + (parseInt(current.amount, 10) || 0),
    0,
  );

  const totalCashCurPayment = cash.reduce(
    (acc, current) =>
      acc +
      (parseInt(
        current.prItems?.find((x) => x.partyId === bill.partyId)?.amount,
        10,
      ) || 0),
    0,
  );
  const totalChequeCurPayment = cash.reduce(
    (acc, current) => acc + parseInt(current.amount, 10) || 0,
    0,
  );
  const totalCurPayment =
    totalCashCurPayment + totalChequeCurPayment + totalCurUpiPayment;

  if (bill.party?.paymentTerms === 'Cash') {
    if (bill.orderAmount <= totalCurPayment) {
      return false;
    }
    return true;
  }

  let lastAmount;

  if (lastPayment?.type === 'cash') {
    lastAmount = lastPayment.prItems.find(
      (x) => x.partyId === bill.partyId,
    )?.amount;
  } else {
    lastAmount = lastPayment?.amount || 0;
  }

  if (bill.party?.paymentTerms === 'Weekly') {
    if (totalCurPayment === 0 && lastPayment) {
      const paymentDays = globalUtils.dateDifferenceInDays(
        bill.billCreationTime,
        lastPayment.timestamp,
      );

      if (paymentDays > 7) {
        return true;
      }
      return false;
    }
    if (totalCurPayment === 0 && !lastPayment) {
      return true;
    }
  }

  if (bill.party?.paymentTerms === 'Monthly') {
    if (totalCurPayment === 0 && lastPayment) {
      const paymentDays = globalUtils.dateDifferenceInDays(
        bill.billCreationTime,
        lastPayment.timestamp,
      );

      if (paymentDays > 30) {
        return true;
      }
      return false;
    }
    if (totalCurPayment === 0 && !lastPayment) {
      return true;
    }
  }

  return false;
};
