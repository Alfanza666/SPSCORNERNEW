import fetch from 'node-fetch';

async function testPayments() {
  try {
    console.log('Testing Direct Payment...');
    const directRes = await fetch('http://localhost:3000/api/payment/ipaymu/direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyer_name: 'Test User',
        buyer_email: 'test@example.com',
        buyer_phone: '08123456789',
        amount: 10000,
        transaction_id: 'test-direct-123',
        payment_method: 'qris',
        payment_channel: 'qris'
      })
    });
    console.log('Direct Response:', await directRes.json());

    console.log('\nTesting Redirect Payment...');
    const redirectRes = await fetch('http://localhost:3000/api/payment/ipaymu/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyer_name: 'Test User',
        buyer_email: 'test@example.com',
        buyer_phone: '08123456789',
        amount: 10000,
        transaction_id: 'test-redirect-123',
        product: ['Test Product'],
        qty: [1],
        price: [10000]
      })
    });
    console.log('Redirect Response:', await redirectRes.json());
  } catch (error) {
    console.error('Error:', error);
  }
}

testPayments();
