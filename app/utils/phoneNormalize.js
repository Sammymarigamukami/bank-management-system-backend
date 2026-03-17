export function normalizeMsisdn(phone) {
  let msisdn = phone.trim();

  if (msisdn.startsWith("+")) {
    msisdn = msisdn.substring(1); // remove "+"
  }
  if (msisdn.startsWith("0")) {
    msisdn = "254" + msisdn.substring(1); // convert 07XX → 2547XX
  }

  // At this point, it should always be 2547XXXXXXXX
  return msisdn;
}