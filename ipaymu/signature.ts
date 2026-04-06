import crypto from 'crypto';

/**
 * Generate Ipaymu HMAC-SHA256 Signature
 * Format: VA:BODY_HASH:METHOD:TIMESTAMP
 * 
 * Doc: https://documenter.getpostman.com/view/40296808/2sB3WtseBT
 */
export function generateIpaymuSignature(
  va: string,
  body: Record<string, any>,
  method: string = 'POST',
  apiKey: string
): { signature: string; timestamp: string } {
  // 1. Hash body dengan SHA256
  const bodyString = JSON.stringify(body);
  const bodyHash = crypto
    .createHash('sha256')
    .update(bodyString)
    .digest('hex')
    .toLowerCase();

  // 2. Generate timestamp format YYYYMMDDHHmmss
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 14);

  // 3. String to sign: VA:BODY_HASH:METHOD:TIMESTAMP
  const stringToSign = `${va}:${bodyHash}:${method}:${timestamp}`;

  console.log('🔐 Ipaymu Signature:', {
    va,
    bodyHash,
    method,
    timestamp,
    stringToSign,
  });

  // 4. Generate HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', apiKey)
    .update(stringToSign)
    .digest('hex');

  return { signature, timestamp };
}

/**
 * Verify Ipaymu callback signature
 */
export function verifyIpaymuSignature(
  callbackData: Record<string, any>,
  receivedSignature: string,
  apiKey: string
): boolean {
  const bodyString = JSON.stringify(callbackData);
  const expectedSignature = crypto
    .createHmac('sha256', apiKey)
    .update(bodyString)
    .digest('hex');

  const isValid = receivedSignature === expectedSignature;
  console.log('🔍 Ipaymu Callback Verification:', { valid: isValid });

  return isValid;
}
