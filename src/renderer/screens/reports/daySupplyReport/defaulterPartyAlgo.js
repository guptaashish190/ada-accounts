// return true if party is defaulter
export default (upis, cheques, cash, bill) => {
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

  if (
    bill.party?.paymentTerms === 'Weekly'
    || bill.party?.paymentTerms === 'Monthly'
  ) {
    return totalCurPayment === 0;
  }

  return false;
};
