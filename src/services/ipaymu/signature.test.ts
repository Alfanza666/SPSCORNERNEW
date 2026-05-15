import test from 'node:test';
import assert from 'node:assert';
import { IpaymuSignature } from './signature.ts';
import CryptoJS from 'crypto-js';

test('IpaymuSignature', async (t) => {
  await t.test('verify()', async (t) => {

    await t.test('returns true for a valid signature', () => {
      const apiKey = 'SANDBOX5AE1B2C3D4E5F6G7H8I9J0';
      const callbackData = {
        trx_id: 12345,
        status: 'berhasil',
        via: 'bca',
        channel: 'va',
      };

      const sortedKeys = Object.keys(callbackData).sort();
      const sortedData: Record<string, any> = {};
      sortedKeys.forEach(key => {
        sortedData[key] = callbackData[key as keyof typeof callbackData];
      });

      const jsonBody = JSON.stringify(sortedData);
      const validSignature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(jsonBody, apiKey)).toLowerCase();

      assert.strictEqual(IpaymuSignature.verify(callbackData, validSignature, apiKey), true);
    });

    await t.test('removes signature property from callbackData before verification', () => {
      const apiKey = 'SANDBOX5AE1B2C3D4E5F6G7H8I9J0';
      const callbackData = {
        trx_id: 12345,
        status: 'berhasil',
        signature: 'this_should_be_ignored'
      };

      // We manually construct expected JSON to verify that "signature" is not included
      const expectedSortedData = { status: 'berhasil', trx_id: 12345 };
      const jsonBody = JSON.stringify(expectedSortedData);
      const validSignature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(jsonBody, apiKey)).toLowerCase();

      assert.strictEqual(IpaymuSignature.verify(callbackData, validSignature, apiKey), true);
    });

    await t.test('sorts keys alphabetically before hashing', () => {
      const apiKey = 'SANDBOX5AE1B2C3D4E5F6G7H8I9J0';
      // Provide keys in reverse alphabetical order
      const callbackData = {
        z_key: 'value_z',
        m_key: 'value_m',
        a_key: 'value_a'
      };

      const jsonBodySorted = JSON.stringify({
        a_key: 'value_a',
        m_key: 'value_m',
        z_key: 'value_z'
      });
      const validSignature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(jsonBodySorted, apiKey)).toLowerCase();

      assert.strictEqual(IpaymuSignature.verify(callbackData, validSignature, apiKey), true);
    });

    await t.test('returns false for an invalid signature', () => {
      const apiKey = 'SANDBOX5AE1B2C3D4E5F6G7H8I9J0';
      const callbackData = {
        trx_id: 12345,
        status: 'berhasil'
      };

      const invalidSignature = 'invalid_signature_string';

      assert.strictEqual(IpaymuSignature.verify(callbackData, invalidSignature, apiKey), false);
    });

    await t.test('returns false when verifying with the wrong API key', () => {
      const correctApiKey = 'SANDBOX5AE1B2C3D4E5F6G7H8I9J0';
      const wrongApiKey = 'WRONG_API_KEY';
      const callbackData = {
        trx_id: 12345,
        status: 'berhasil'
      };

      const sortedKeys = Object.keys(callbackData).sort();
      const sortedData: Record<string, any> = {};
      sortedKeys.forEach(key => {
        sortedData[key] = callbackData[key as keyof typeof callbackData];
      });

      const jsonBody = JSON.stringify(sortedData);
      const signatureGeneratedWithCorrectKey = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(jsonBody, correctApiKey)).toLowerCase();

      // Verify with wrong key
      assert.strictEqual(IpaymuSignature.verify(callbackData, signatureGeneratedWithCorrectKey, wrongApiKey), false);
    });

    await t.test('does not mutate the original callbackData object', () => {
      const apiKey = 'SANDBOX5AE1B2C3D4E5F6G7H8I9J0';
      const originalCallbackData = {
        trx_id: 12345,
        signature: 'some_sig'
      };
      const dataToVerify = { ...originalCallbackData };

      IpaymuSignature.verify(dataToVerify, 'any_sig', apiKey);

      assert.deepStrictEqual(dataToVerify, originalCallbackData, 'The callbackData object should not be mutated');
    });
  });
});
