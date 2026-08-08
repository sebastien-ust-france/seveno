const CHECKOUT_TECHNICAL_PARAMETERS = ['checkout', 'orderId', 'session_id'] as const;

export function withoutStripeCheckoutReturnParameters(pathname: string, search: string) {
  const parameters = new URLSearchParams(search);
  for (const name of CHECKOUT_TECHNICAL_PARAMETERS) parameters.delete(name);
  const remaining = parameters.toString();
  return remaining ? `${pathname}?${remaining}` : pathname;
}
