import { describe, it } from 'node:test';
import assert from 'node:assert';
import CryptoJS from 'crypto-js';
import { IpaymuSignature } from './signature.ts';

describe('IpaymuSignature.verify', () => {
  const mockApiKey = 'test-api-key-123';

  // Helper to simulate Ipaymu's signature generation logic for callbacks
  const generateExpectedSignature = (data: Record<string, any>, apiKey: string) => {
    const dataCopy = { ...data };
    delete dataCopy.signature;
    const sortedKeys = Object.keys(dataCopy).sort();
    const sortedData: Record<string, any> = {};
    sortedKeys.forEach(key => {
      sortedData[key] = dataCopy[key];
    });
    const jsonBody = JSON.stringify(sortedData);
    return CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(jsonBody, apiKey)).toLowerCase();
  };

  it('should return true for a valid signature', () => {
    const callbackData = {
      trx_id: 12345,
      status: 'berhasil',
      status_code: 1,
      sid: 'test-sid',
      reference_id: 'ref-123'
    };

    const validSignature = generateExpectedSignature(callbackData, mockApiKey);
    const dataWithSignature = { ...callbackData, signature: validSignature };

    const result = IpaymuSignature.verify(dataWithSignature, validSignature, mockApiKey);

    assert.strictEqual(result, true, 'Signature should be valid');
  });

  it('should return false for an invalid signature', () => {
    const callbackData = {
      trx_id: 12345,
      status: 'berhasil',
      status_code: 1,
      sid: 'test-sid',
      reference_id: 'ref-123'
    };

    const invalidSignature = 'invalid-signature-abc';
    const dataWithSignature = { ...callbackData, signature: invalidSignature };

    const result = IpaymuSignature.verify(dataWithSignature, invalidSignature, mockApiKey);

    assert.strictEqual(result, false, 'Signature should be invalid');
  });

  it('should sort keys correctly before verifying', () => {
    // Unordered keys
    const callbackDataUnordered = {
      status_code: 1,
      trx_id: 12345,
      reference_id: 'ref-123',
      sid: 'test-sid',
      status: 'berhasil',
    };

    // We expect the verify method to internally sort these same as the helper does
    const validSignature = generateExpectedSignature(callbackDataUnordered, mockApiKey);
    const dataWithSignature = { ...callbackDataUnordered, signature: validSignature };

    const result = IpaymuSignature.verify(dataWithSignature, validSignature, mockApiKey);

    assert.strictEqual(result, true, 'Signature with unordered keys should be valid due to internal sorting');
  });

  it('should return false if wrong API key is used', () => {
    const callbackData = {
      trx_id: 12345,
      status: 'berhasil'
    };

    const validSignature = generateExpectedSignature(callbackData, mockApiKey);
    const dataWithSignature = { ...callbackData, signature: validSignature };

    const wrongApiKey = 'wrong-api-key';
    const result = IpaymuSignature.verify(dataWithSignature, validSignature, wrongApiKey);

    assert.strictEqual(result, false, 'Signature should be invalid with wrong API key');
  });

  it('should not mutate the original callbackData object', () => {
    const callbackData = {
      trx_id: 12345,
      status: 'berhasil',
      signature: 'dummy-signature'
    };

    // Create a deep copy to compare against later
    const originalDataStr = JSON.stringify(callbackData);

    const validSignature = generateExpectedSignature(callbackData, mockApiKey);

    IpaymuSignature.verify(callbackData, validSignature, mockApiKey);

    assert.strictEqual(JSON.stringify(callbackData), originalDataStr, 'Original object should not be mutated');
    assert.ok('signature' in callbackData, 'Signature key should still exist in original object');
  });
});
