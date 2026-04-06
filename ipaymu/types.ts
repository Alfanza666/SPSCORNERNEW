// ipaymu/types.ts

// TypeScript interfaces for the Ipaymu API

export interface PaymentRequest {
    order_id: string;
    price: number;
    purchase_expire: string;
    item_name: string;
    item_category: string;
    item_qty: number;
    return_url: string;
    cancel_url: string;
    notif_url: string;
    custom_field?: string;
}

export interface PaymentResponse {
    success: boolean;
    status: string;
    data?: any;
}

export interface CallbackData {
    order_id: string;
    transaction_id: string;
    status: string;
    amount: number;
    // Additional fields can be added here
}
