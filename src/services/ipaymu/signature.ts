import CryptoJS from 'crypto-js';

/**
 * Generate Ipaymu HMAC-SHA256 Signature
 * Format: VA:BODY_HASH:METHOD:TIMESTAMP
 * 
 * Referensi: https://documenter.getpostman.com/view/40296808/2sB3WtseBT
 */
export class IpaymuSignature {
  /**
   * Generate signature untuk API request
   */
  static generate(
    va: string,
    body: Record<string, any>,
    method: string = 'POST',
    apiKey: string
  ): { signature: string; timestamp: string; jsonBody: string } {
    // 1. Hash body dengan SHA256
    const jsonBody = JSON.stringify(body);
    const bodyEncrypt = CryptoJS.SHA256(jsonBody).toString(CryptoJS.enc.Hex).toLowerCase();

    // 2. Generate timestamp format YYYYMMDDHHmmss
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

    // 3. String to sign: METHOD:VA:BODY_HASH:APIKEY
    const stringtosign = `${method}:${va}:${bodyEncrypt}:${apiKey}`;

    console.log('🔐 Signature Debug:', {
      va,
      bodyHash: bodyEncrypt,
      method,
      timestamp,
      stringToSign: stringtosign,
    });

    // 4. Generate HMAC-SHA256 signature
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
    console.log('🔍 Callback Verification:', { valid: isValid, expected: expectedSignature, received: receivedSignature });

    return isValid;
  }
}
