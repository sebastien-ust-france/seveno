const MOVEMENT_LABELS: Record<string, string> = {
  purchase: 'Achat d\u2019un cr\u00e9dit',
  campaign_activation: 'Activation d\u2019une campagne',
  admin_grant: 'Attribution administrative',
  admin_correction: 'Correction administrative',
  admin_restoration: 'R\u00e9tablissement administratif',
};

export function getBillingMovementLabel(operationCode: string) {
  return MOVEMENT_LABELS[operationCode] ?? 'Ajustement du compte';
}

export function formatBillingMovementVariation(quantity: number) {
  if (quantity > 0) return `+${quantity}`;
  if (quantity < 0) return `\u2212${Math.abs(quantity)}`;
  return '0';
}

export function formatBillingMovementDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date indisponible';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
