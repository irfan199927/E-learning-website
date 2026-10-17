/**
 * Manual UPI payments (no gateway). The school publishes its UPI ID / number; a student pays from their own UPI
 * app and reports the transaction reference (UTR); an admin checks it against the bank statement and approves.
 * Pure helpers only: no I/O.
 */

/** "₹1,500" or "₹1,499.50", Indian digit grouping. */
export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * A `upi://pay` link (NPCI deep-link format): on a phone it opens the student's UPI app with the payee, amount and
 * a note filled in. The student still confirms the payment in their app.
 */
export function upiPayLink(p: {
  upiId: string;
  payeeName?: string | null;
  amountInPaise: number;
  note: string;
}): string {
  const params = new URLSearchParams({
    pa: p.upiId,
    cu: "INR",
    am: (p.amountInPaise / 100).toFixed(2),
    tn: p.note.slice(0, 50),
  });
  if (p.payeeName) params.set("pn", p.payeeName);
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const QR_MAX_BYTES = 2 * 1024 * 1024;
/** Image types for QR codes and payment screenshots, with the extension each is stored under. */
export const PAYMENT_IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
