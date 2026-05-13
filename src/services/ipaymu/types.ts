// Ipaymu API Request/Response Types
export interface IpaymuConfig {
  va: string;
  apiKey: string;
  production: boolean;
}

export interface PaymentRequest {
  name: string;
  email: string;
  phone: string;
  amount: number;
  notifyUrl: string;
  returnUrl?: string;
  cancelUrl?: string;
  referenceId: string;
  product?: string[];
  qty?: number[];
  price?: number[];
  paymentMethod?: string;
  paymentChannel?: string;
}

export interface DirectPaymentRequest extends PaymentRequest {
  paymentMethod: string;
  paymentChannel: string;
}

export interface IpaymuResponse {
  Status: number;
  Message: string;
  Data?: {
    Url?: string;
    SessionId?: string;
    TransactionId?: string;
    QrCode?: string;
  };
}

export interface CallbackPayload {
  status: 'berhasil' | 'gagal' | 'pending';
  reference_id: string;
  transaction_id: string;
  amount: number;
  payment_method?: string;
  timestamp?: string;
}
