// Formats number to Indian Currency string (e.g. ₹2,499.00)
export function formatINR(amount: number | string | undefined | null): string {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(num);
}

// Convert number to Indian English words (e.g., 2550 -> "Two Thousand Five Hundred Fifty Rupees Only")
export function amountInWords(num: number): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'Zero Rupees Only';

  function convertTwoDigits(val: number): string {
    if (val === 0) return '';
    if (val < 20) return a[val];
    const tens = b[Math.floor(val / 10)];
    const units = a[val % 10];
    return units ? `${tens} ${units}` : tens;
  }

  function convertThreeDigits(val: number): string {
    const hundred = Math.floor(val / 100);
    const rest = val % 100;
    let str = '';
    if (hundred > 0) {
      str += `${a[hundred]} Hundred`;
      if (rest > 0) str += ' and ';
    }
    if (rest > 0) {
      str += convertTwoDigits(rest);
    }
    return str;
  }

  let words = '';

  // Crores (1,00,00,000)
  const crores = Math.floor(n / 10000000);
  let remainder = n % 10000000;

  // Lakhs (1,00,000)
  const lakhs = Math.floor(remainder / 100000);
  remainder = remainder % 100000;

  // Thousands (1,000)
  const thousands = Math.floor(remainder / 1000);
  remainder = remainder % 1000;

  // Hundreds and units
  const hundreds = remainder;

  if (crores > 0) {
    words += `${convertTwoDigits(crores)} Crore `;
  }
  if (lakhs > 0) {
    words += `${convertTwoDigits(lakhs)} Lakh `;
  }
  if (thousands > 0) {
    words += `${convertTwoDigits(thousands)} Thousand `;
  }
  if (hundreds > 0) {
    words += `${convertThreeDigits(hundreds)} `;
  }

  return `${words.trim()} Rupees Only`;
}
