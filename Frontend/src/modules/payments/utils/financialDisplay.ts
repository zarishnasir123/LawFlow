/** Normalize legacy LF-RCP-* numbers to RC-YYYY-NNNN for display. */
export function displayReceiptNumber(raw?: string | null): string {
  if (!raw) return "—";
  if (/^RC-\d{4}-\d{4}$/.test(raw)) return raw;

  const legacy = raw.match(/^LF-RCP-(\d{4})-(\d+)$/i);
  if (legacy) {
    const seq = legacy[2].slice(-4).padStart(4, "0");
    return `RC-${legacy[1]}-${seq}`;
  }

  return raw;
}

export function displayTransactionNumber(raw?: string | null): string {
  if (!raw) return "—";
  if (/^TXN-\d{4}-\d{4}$/.test(raw)) return raw;
  return raw;
}
