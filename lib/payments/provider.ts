export type PaymentOutcome =
  | "succeeded"
  | "retryable_failure"
  | "terminal_failure"
  | "cancelled";

export type PaymentNextAction =
  | { type: "redirect"; url: string }
  | { type: "client_secret"; clientSecret: string }
  | { type: "none" };

export interface PaymentInitializationInput {
  checkoutSessionId: string;
  amountCents: number;
  currency: "usd";
  buyerId: string;
  buyerEmail?: string | null;
  shippingAddress?: {
    name: string;
    line1: string;
    line2?: string | null;
    city: string;
    state?: string | null;
    postalCode: string;
    country: string;
  } | null;
}

export interface PaymentInitializationResult {
  provider: string;
  providerPaymentId: string;
  nextAction: PaymentNextAction;
}

export interface NormalizedPaymentEvent {
  provider: string;
  eventId: string;
  eventType: string;
  checkoutSessionId: string;
  providerPaymentId: string;
  outcome: PaymentOutcome;
}

export interface PaymentProviderAdapter {
  readonly name: string;
  readonly configured: boolean;
  initializePayment(input: PaymentInitializationInput): Promise<PaymentInitializationResult>;
  verifyWebhook(request: Request): Promise<NormalizedPaymentEvent>;
}

export class PaymentProviderUnavailableError extends Error {
  constructor(message = "Payment processing is not configured yet") {
    super(message);
    this.name = "PaymentProviderUnavailableError";
  }
}

class UnconfiguredPaymentProvider implements PaymentProviderAdapter {
  readonly name = "unconfigured";
  readonly configured = false;

  async initializePayment(): Promise<PaymentInitializationResult> {
    throw new PaymentProviderUnavailableError();
  }

  async verifyWebhook(): Promise<NormalizedPaymentEvent> {
    throw new PaymentProviderUnavailableError("Payment webhook is not configured yet");
  }
}

/**
 * Canonical payment-adapter resolver.
 *
 * EntizNetStore intentionally defaults to `unconfigured` until a production
 * processor that accepts the marketplace business model and legal entity is
 * approved. Adding a processor means implementing this interface and wiring it
 * here; checkout/order/inventory/escrow code must not depend on provider SDKs.
 */
export function getPaymentProvider(): PaymentProviderAdapter {
  const provider = process.env.PAYMENT_PROVIDER?.trim().toLowerCase() || "unconfigured";

  switch (provider) {
    case "unconfigured":
      return new UnconfiguredPaymentProvider();
    default:
      throw new PaymentProviderUnavailableError(
        `Unsupported payment provider configuration: ${provider}`,
      );
  }
}
