export function buildUpiPaymentUrl(params: {
  upiId?: string | null;
  receiverName?: string | null;
  amount: number;
  note: string;
}) {
  const upiId = params.upiId?.trim();
  if (!upiId) return '';

  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    params.receiverName?.trim() || 'HostelHub'
  )}&am=${encodeURIComponent(String(params.amount))}&cu=INR&tn=${encodeURIComponent(params.note)}`;
}

export function getSettingValue(settings: { key: string; value: string }[] | undefined, key: string) {
  return settings?.find((setting) => setting.key === key)?.value?.trim() || '';
}
