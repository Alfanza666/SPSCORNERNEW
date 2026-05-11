export interface TransactionItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  subtotal: number;
  status?: string;
  metadata?: any;
  products?: {
    name: string;
    image_url?: string;
    category?: string;
  };
}

export interface Transaction {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  receipt_image?: string;
  pickup_code?: string;
  transaction_items?: TransactionItem[];
}
