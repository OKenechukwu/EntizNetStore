export type PayoutOutcome =
  | "succeeded"
  | "retryable_failure"
  | "terminal_failure"
  | "cancelled";

export interface PayoutInitializationInput {
  payoutRequestId: string;
  sellerId: string;
  amountCents: number;
  currency: "usd";
  /**
   * Server-only payout destination configuration from profiles_seller_private.
   * Adapters must never log or return this object to the browser.
   */
  payoutMethod: Record<string, unknown>;
}

export interface PayoutInitializationResult {
  provider: string;
  providerPayoutId: string;
}

export interface NormalizedPayoutEvent {
  provider: string;
  eventId: string;
  eventType: string;
  payoutRequestId: string;
  providerPayoutId: string;
  outcome: PayoutOutcome;
}

export interface PayoutProviderAdapter {
  readonly name: string;
  readonly configured: boolean;

  /**
   * A real adapter MUST use payoutRequestId as the provider-side idempotency
   * reference. A timeout may occur after a provider accepted a transfer, so the
   * application deliberately keeps escrow reserved until reconciliation rather
   * than assuming an initialization error means no money moved.
   */
  initializePayout(input: PayoutInitializationInput): Promise<PayoutInitializationResult>;

  /** Verify the provider signature before returning a normalized event. */
  verifyWebhook(request: Request): Promise<NormalizedPayoutEvent>;
}

export class PayoutProviderUnavailableError extends Error {
  constructor(message = "Seller payouts are pending processor onboarding") {
    super(message);
    this.name = "PayoutProviderUnavailableError";
  }
}

class UnconfiguredPayoutProvider implements PayoutProviderAdapter {
  readonly name = "unconfigured";
  readonly configured = false;

  async initializePayout(): Promise<PayoutInitializationResult> {
    throw new PayoutProviderUnavailableError();
  }

  async verifyWebhook(): Promise<NormalizedPayoutEvent> {
    throw new PayoutProviderUnavailableError("Payout webhook is not configured yet");
  }
}

/**
 * Canonical payout-provider resolver.
 *
 * EntizNetStore owns the payout ledger and escrow state. The external bank/
 * payment processor remains an adapter selected during pre-launch onboarding.
 */
export function getPayoutProvider(): PayoutProviderAdapter {
  const provider = process.env.PAYOUT_PROVIDER?.trim().toLowerCase() || "unconfigured";

  switch (provider) {
    case "unconfigured":
      return new UnconfiguredPayoutProvider();
    default:
      throw new PayoutProviderUnavailableError(
        `Unsupported payout provider configuration: ${provider}`,
      );
  }
}
