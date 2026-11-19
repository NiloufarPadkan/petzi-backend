export interface GatewaySettings {
  code: string;
  merchantId?: string;
  apiKey?: string;
  sandbox: boolean;
}

export interface GatewayInitiateInput {
  paymentId: string;
  /** Toman. Providers convert to their own unit. */
  amountToman: number;
  description: string;
  callbackUrl: string;
}

export interface GatewayInitiateResult {
  /** The provider's reference for the payment; stored on the payment. */
  authority: string;
  /** Where to send the payer. */
  redirectUrl: string;
}

export interface GatewayVerifyInput {
  authority: string;
  amountToman: number;
}

export interface GatewayVerifyResult {
  success: boolean;
  /** Provider's reference number (RRN). */
  referenceId?: string;
  cardPan?: string;
  message?: string;
}

export interface PaymentGatewayProvider {
  readonly code: string;
  initiate(
    settings: GatewaySettings,
    input: GatewayInitiateInput,
  ): Promise<GatewayInitiateResult>;
  verify(
    settings: GatewaySettings,
    input: GatewayVerifyInput,
  ): Promise<GatewayVerifyResult>;
}
