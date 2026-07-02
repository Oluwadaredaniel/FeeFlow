// Kobo (int) → "₦5,000.00"
export const formatNaira = (kobo: number) =>
  "₦" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Kobo → "₦5,000" (no decimals, for compact tables/cards)
export const formatNairaShort = (kobo: number) =>
  "₦" + Math.round(kobo / 100).toLocaleString("en-NG");

// percent paid for a fee (guard divide-by-zero)
export const percentPaid = (paid: number, due: number) => (due === 0 ? 100 : Math.round((paid / due) * 100));
