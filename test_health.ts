import axios from 'axios';
async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/health');
    console.log(res.data);
  } catch (e: any) {
    console.error(e.message);
  }
}
test();
