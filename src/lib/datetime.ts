/**
 * Converts a database date string (which may be UTC or ISO format)
 * into a local device Date object, ensuring proper timezone conversion.
 */
export function parseDeviceDate(dateInput?: string | Date | null): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;

  const str = String(dateInput).trim();
  if (!str) return new Date();

  // If format is SQLite "YYYY-MM-DD HH:mm:ss" without offset/Z, SQLite stores UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(str)) {
    return new Date(str.replace(' ', 'T') + 'Z');
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Formats a date into Indian format (DD/MM/YYYY) in the device's local timezone.
 */
export function formatDeviceDate(dateInput?: string | Date | null): string {
  const d = parseDeviceDate(dateInput);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formats time into 12-hour format with AM/PM (e.g. 05:15 PM) in the device's local timezone.
 */
export function formatDeviceTime(dateInput?: string | Date | null): string {
  const d = parseDeviceDate(dateInput);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formats combined date and time for invoices.
 */
export function formatDeviceDateTime(dateInput?: string | Date | null): { date: string; time: string } {
  return {
    date: formatDeviceDate(dateInput),
    time: formatDeviceTime(dateInput)
  };
}
