const simulateNetworkCall = async (id) => {
  return new Promise(resolve => setTimeout(resolve, 50)); // 50ms simulated latency
};

async function runBenchmark() {
  const reservations = Array.from({ length: 5 }, (_, i) => i);

  console.log("Starting benchmark with 5 reservations (50ms latency each)");

  // Sequential
  const startSeq = performance.now();
  for (const resId of reservations) {
    await simulateNetworkCall(resId);
  }
  const endSeq = performance.now();
  const timeSeq = endSeq - startSeq;
  console.log(`Sequential execution time: ${timeSeq.toFixed(2)} ms`);

  // Parallel
  const startPar = performance.now();
  await Promise.all(reservations.map(resId => simulateNetworkCall(resId)));
  const endPar = performance.now();
  const timePar = endPar - startPar;
  console.log(`Parallel execution time: ${timePar.toFixed(2)} ms`);

  console.log(`Improvement: ${((timeSeq - timePar) / timeSeq * 100).toFixed(2)}% faster`);
}

runBenchmark();
