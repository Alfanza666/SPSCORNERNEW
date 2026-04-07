import fetch from 'node-fetch';

async function testDebug() {
  const res = await fetch('http://localhost:3000/api/payment/ipaymu/debug');
  console.log(await res.json());
}
testDebug();
