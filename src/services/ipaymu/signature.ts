import CryptoJS from 'crypto-js';

/**
 * Generate Ipaymu HMAC-SHA256 Signature
 * 
 * API Request Signature (for creating payments, checking transactions):
 *   Format: METHOD:VA:SHA256(JSON_BODY):API_KEY
 *   HMAC Key: API_KEY
 * 
 * Callback Signature (for receiving notifications):
 *   Sort keys A-Z → normalize types → JSON.stringify → escape "/" → HMAC-SHA256
 *   HMAC Key: VA_NUMBER (NOT API_KEY)
 * 
 * Referensi:
 *   - Signature: https://docs.ipaymu.com/id/docs/signature
 *   - Callback:  https://docs.ipaymu.com/id/docs/callback
 */
export class IpaymuSignature {
  /**
   * Generate signature untuk API request
   * Format: METHOD:VA:SHA256(BODY):API_KEY
   * HMAC Key: API_KEY
   */
  static generate(
    va: string,
    body: Record<string, any>,
    method: string = 'POST',
    apiKey: string
  ): { signature: string; timestamp: string; jsonBody: string } {
    // 1. Stringify body
    const jsonBody = JSON.stringify(body);

    // 2. Hash body dengan SHA256 (lowercase hex)
    const bodyEncrypt = CryptoJS.SHA256(jsonBody).toString(CryptoJS.enc.Hex).toLowerCase();

    // 3. Generate timestamp format YYYYMMDDHHmmss
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

    // 4. String to sign: METHOD:VA:SHA256(BODY):API_KEY
    const stringtosign = `${method}:${va}:${bodyEncrypt}:${apiKey}`;

    // 5. Generate HMAC-SHA256 signature using API_KEY as the HMAC key
    const signature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(stringtosign, apiKey)).toLowerCase();

    return { signature, timestamp, jsonBody };
  }

  /**
   * Verify callback signature dari Ipaymu
   * 
   * PER iPaymu OFFICIAL DOCS:
   * - Secret key = VA Number (NOT API Key)
   * - Normalize types: trx_id/status_code/transaction_status_code/paid_off → int, is_escrow → bool, additional_info → []
   * - Sort keys A-Z (case-sensitive, localeCompare)
   * - JSON.stringify → escape "/" → "\/"
   * - HMAC-SHA256(sortedJSON, VA_NUMBER)
   * 
   * Referensi: https://docs.ipaymu.com/id/docs/callback
   */
  static verify(
    callbackData: Record<string, any>,
    receivedSignature: string,
    vaNumber: string
  ): boolean {
    // 1. Copy data and remove signature fields
    const data: Record<string, any> = { ...callbackData };
    delete data.signature;
    delete data.Signature;

    // 2. Normalize type data (per iPaymu docs)
    const INT_KEYS = ['trx_id', 'status_code', 'transaction_status_code', 'paid_off'];
    const BOOL_KEYS = ['is_escrow', 'is_refund'];
    const result: Record<string, any> = {};
    for (const key in data) {
      let val = data[key];
      if (INT_KEYS.includes(key)) {
        result[key] = parseInt(val, 10);
      } else if (BOOL_KEYS.includes(key)) {
        result[key] = (val === 'true' || val === '1' || val === 1);
      } else if (key === 'additional_info') {
        if (val === '[]' || val === undefined || val === null) {
          result[key] = [];
        } else {
          result[key] = val;
        }
      } else {
        result[key] = String(val);
      }
    }
    // Ensure additional_info always exists
    if (!result.hasOwnProperty('additional_info')) {
      result['additional_info'] = [];
    }

    // 3. Sort keys ascending A-Z (case-sensitive, per iPaymu docs)
    const sortedKeys = Object.keys(result).sort((a, b) => a.localeCompare(b));
    const sortedData: Record<string, any> = {};
    sortedKeys.forEach(key => {
      sortedData[key] = result[key];
    });

    // 4. JSON stringify + escape slash (per iPaymu docs: "/" → "\/")
    let jsonBody = JSON.stringify(sortedData);
    jsonBody = jsonBody.replace(/\//g, '\\/');

    // 5. HMAC-SHA256 with VA Number as secret key (NOT API Key)
    const expectedSignature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(jsonBody, vaNumber)).toLowerCase();

    return receivedSignature === expectedSignature;
  }
}
