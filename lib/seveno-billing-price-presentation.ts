const EURO_FORMATTER = new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true,
});

export function formatBillingPrice(cents: number) {
  return EURO_FORMATTER.format(cents / 100);
}
