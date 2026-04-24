async function run() {
  const res = await fetch('http://localhost:3000/api/digital/check-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction_item_id: '123e4567-e89b-12d3-a456-426614174000' })
  });
  console.log(await res.text());
}
run();
