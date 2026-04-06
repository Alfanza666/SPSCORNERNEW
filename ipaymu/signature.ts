import crypto from 'crypto';

export function generateSignature(secret: string, params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    const sortedParams = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    const hash = crypto.createHmac('sha256', secret).update(sortedParams).digest('hex');
    return hash;
}