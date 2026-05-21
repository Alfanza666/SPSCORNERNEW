import { supabase } from '../lib/supabase';

export interface CompleteOrderResult {
  success: boolean;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  error?: string;
}

/**
 * Memproses pesanan yang selesai dengan memotong fee admin di awal (Opsi A)
 * @param orderId ID pesanan dari tabel orders
 * @param sellerId ID user milik seller
 * @param grossAmount Total nominal kotor yang dibayar oleh pembeli
 */
export const completeOrderWithNetRevenue = async (
  orderId: string,
  sellerId: string,
  grossAmount: number
): Promise<CompleteOrderResult> => {
  try {
    // 1. Hitung Potongan Admin murni sebesar 0,8% dengan pembulatan nilai terdekat
    const feeAmount = Math.round(grossAmount * 0.008);
    
    // 2. Hitung Pendapatan Bersih yang menjadi hak seller sepenuhnya
    const netAmount = grossAmount - feeAmount;

    // 3. Masukkan Pendapatan Bersih ke dalam riwayat transaksi seller
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        seller_id: sellerId,
        order_id: orderId,
        type: 'INCOME', // Menandakan dana masuk
        amount: netAmount, // Nilai BERSIH yang disimpan ke saldo seller
        description: `Pendapatan bersih pesanan #${orderId.substring(0, 8)} (Setelah potongan 0.8%)`,
        created_at: new Date().toISOString()
      });

    if (txError) throw txError;

    // 4. Catat Potongan Admin (0,8%) ke dalam sistem untuk laporan internal perusahaan
    const { error: feeLogError } = await supabase
      .from('platform_revenues')
      .insert({
        order_id: orderId,
        seller_id: sellerId,
        amount_gross: grossAmount,
        fee_applied: feeAmount,
        description: `Fee transaksi 0.8% dari pesanan #${orderId.substring(0, 8)}`,
        created_at: new Date().toISOString()
      });

    // Jangan gagalkan proses utama jika pencatatan laporan internal ini error, cukup log saja
    if (feeLogError) {
      console.warn('Gagal mencatat log pendapatan platform:', feeLogError.message);
    }

    // 5. Perbarui status pesanan utama menjadi selesai
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'COMPLETED' })
      .eq('id', orderId);

    if (orderError) throw orderError;

    return {
      success: true,
      grossAmount,
      feeAmount,
      netAmount
    };

  } catch (error: any) {
    console.error('Kritis: Gagal memproses data pendapatan bersih:', error);
    return {
      success: false,
      grossAmount,
      feeAmount: 0,
      netAmount: 0,
      error: error.message || 'Terjadi kesalahan sistem internal.'
    };
  }
};

/**
 * Menghitung saldo bersih seller saat ini secara akurat (Real-time Agregasi)
 * Menghindari bug kolom balance tersendat
 * @param sellerId ID user milik seller
 */
export const getSellerCurrentBalance = async (sellerId: string): Promise<number> => {
  try {
    // Hitung total semua pemasukan bersih
    const { data: incomes, error: incError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('seller_id', sellerId)
      .eq('type', 'INCOME');

    if (incError) throw incError;

    // Hitung total semua penarikan yang sedang pending atau sudah sukses dicairkan
    const { data: withdrawals, error: witError } = await supabase
      .from('withdrawals')
      .select('amount')
      .eq('seller_id', sellerId)
      .in('status', ['PENDING', 'APPROVED', 'DIBAYAR']);

    if (witError) throw witError;

    const totalIncome = incomes?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
    const totalWithdrawal = withdrawals?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

    // Sisa saldo real-time
    return totalIncome - totalWithdrawal;
  } catch (error) {
    console.error('Gagal mengambil kalkulasi saldo:', error);
    return 0;
  }
};
