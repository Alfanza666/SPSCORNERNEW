import fetch from 'node-fetch';
async function test() {
  const res = await fetch('http://127.0.0.1:3000/api/debug-schema');
  console.log(await res.text());
}
test();
