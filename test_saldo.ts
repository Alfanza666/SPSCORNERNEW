import axios from 'axios';

async function testSaldo() {
  try {
    const res = await axios.get('http://localhost:3000/api/digital/cek-saldo');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e: any) {
    console.error(e.response?.data || e.message);
  }
}

testSaldo();
