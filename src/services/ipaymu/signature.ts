import CryptoJS from 'crypto-js';

/**
 * Generate Ipaymu HMAC-SHA256 Signature
 * 
 * Format String-to-Sign: VA:SHA256(body):METHOD:TIMESTAMP
 * HMAC Key: API_KEY
 * 
 * Referensi: https://documenter.getpostman.com/view/40296808/2sB3WtseBT
 * 
 * PERBAIKAN KRITIS: Format sebelumnya SALAH: "METHOD:VA:BODY_HASH:APIKEY"
 * Format yang BENAR per sample resmi iPaymu: "VA:BODY_HASH:METHOD:TIMESTAMP"
 * (lihat file ipaymu_direct_payment.js - line 25)
 */
export class IpaymuSignature {
  /**
   * Generate signature untuk API request
   * Format: VA:SHA256(BODY):METHOD:TIMESTAMP
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

    // 4. String to sign: METHOD:VA:BODY_HASH:APIKEY
    const stringtosign = `${method}:${va}:${bodyEncrypt}:${apiKey}`;

    // 5. Generate HMAC-SHA256 signature using API_KEY as the HMAC key
    const signature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(stringtosign, apiKey)).toLowerCase();

    return { signature, timestamp, jsonBody };
  }

  /**
   * Verify callback signature dari Ipaymu
   */
  static verify(
    callbackData: Record<string, any>,
    receivedSignature: string,
    apiKey: string
  ): boolean {
    // 1. Copy data and remove signature
    const data = { ...callbackData };
    delete data.signature;

    // 2. Sort keys ascending (like ksort in PHP)
    const sortedKeys = Object.keys(data).sort();
    const sortedData: Record<string, any> = {};
    sortedKeys.forEach(key => {
      sortedData[key] = data[key];
    });

    // 3. Generate Signature
    const jsonBody = JSON.stringify(sortedData);
    const expectedSignature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(jsonBody, apiKey)).toLowerCase();
    const isValid = receivedSignature === expectedSignature;

    return isValid;
  }
}
