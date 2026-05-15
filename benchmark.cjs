const { performance } = require('perf_hooks');

const mockDigitalItems = Array.from({ length: 50 }, (_, i) => ({
  id: `item-${i}`,
  metadata: { foo: `bar-${i}` }
}));

const mockSupabase = {
  from: () => ({
    update: (data) => ({
      eq: async (col, val) => {
        // Simulate network delay
        return new Promise(resolve => setTimeout(resolve, 10));
      }
    })
  })
};

async function testSequential() {
  const start = performance.now();
  for (const item of mockDigitalItems) {
    await mockSupabase
      .from("transaction_items")
      .update({
        metadata: {
          ...item.metadata,
          status: "failed",
        },
      })
      .eq("id", item.id);
  }
  const end = performance.now();
  return end - start;
}

async function testConcurrent() {
  const start = performance.now();
  const promises = mockDigitalItems.map(item =>
    mockSupabase
      .from("transaction_items")
      .update({
        metadata: {
          ...item.metadata,
          status: "failed",
        },
      })
      .eq("id", item.id)
  );
  await Promise.all(promises);
  const end = performance.now();
  return end - start;
}

async function runBenchmark() {
  console.log('Running sequential test...');
  const seqTime = await testSequential();
  console.log(`Sequential time: ${seqTime.toFixed(2)} ms`);

  console.log('Running concurrent test...');
  const concTime = await testConcurrent();
  console.log(`Concurrent time: ${concTime.toFixed(2)} ms`);

  console.log(`Improvement: ${((seqTime - concTime) / seqTime * 100).toFixed(2)}% faster`);
}

runBenchmark();
