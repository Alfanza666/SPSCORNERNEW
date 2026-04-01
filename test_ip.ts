import axios from 'axios';
async function test() {
  try {
    const res = await axios.get('https://api.ipify.org');
    console.log(res.data);
  } catch (e: any) {
    console.error(e.message);
  }
}
test();
