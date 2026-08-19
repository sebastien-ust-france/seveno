import type { BillingOrderStatusView } from '@/types/seveno-billing';

type TimerHandle = ReturnType<typeof setTimeout>;

export type StripeOrderPollingOptions = {
  readStatus: (signal: AbortSignal) => Promise<BillingOrderStatusView>;
  onConfirmed: (order: BillingOrderStatusView) => void | Promise<void>;
  onPending: (order: BillingOrderStatusView | null) => void;
  onTerminal: (order: BillingOrderStatusView) => void;
  maxAttempts?: number;
  delayMs?: number;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
};

const TERMINAL_STATUSES = new Set(['failed', 'cancelled', 'expired']);

export function startStripeOrderStatusPolling(options: StripeOrderPollingOptions) {
  const maxAttempts = options.maxAttempts ?? 5;
  const delayMs = options.delayMs ?? 2000;
  const setTimer = options.setTimer ?? ((callback, delay) => globalThis.setTimeout(callback, delay));
  const clearTimer = options.clearTimer ?? ((handle) => globalThis.clearTimeout(handle));
  let attempts = 0;
  let stopped = false;
  let requestActive = false;
  let timer: TimerHandle | null = null;
  let controller: AbortController | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer !== null) { clearTimer(timer); timer = null; }
    controller?.abort();
    controller = null;
  };

  const poll = async () => {
    if (stopped || requestActive || attempts >= maxAttempts) return;
    requestActive = true;
    attempts += 1;
    controller = new AbortController();
    let shouldContinue = false;
    try {
      const order = await options.readStatus(controller.signal);
      if (stopped) return;
      if (order.entitlementApplied === true || order.status === 'paid') {
        stop();
        await options.onConfirmed(order);
        return;
      }
      if (TERMINAL_STATUSES.has(order.status)) {
        stop();
        options.onTerminal(order);
        return;
      }
      options.onPending(order);
      shouldContinue = attempts < maxAttempts;
    } catch (error) {
      if (stopped || (error instanceof DOMException && error.name === 'AbortError')) return;
      options.onPending(null);
      shouldContinue = attempts < maxAttempts;
    } finally {
      requestActive = false;
      controller = null;
    }
    if (!stopped && shouldContinue) timer = setTimer(() => { timer = null; void poll(); }, delayMs);
  };

  void poll();
  return { stop, getAttempts: () => attempts };
}
