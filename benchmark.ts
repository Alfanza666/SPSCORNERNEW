import { supabase } from './src/lib/supabase.ts';
import { performance } from 'perf_hooks';

// Simulate standard Supabase fetch behaviour with simulated network delay
async function simulateQuery(table: string, time: number = 50) {
  return new Promise(resolve => setTimeout(() => resolve({ data: [], error: null }), time));
}

async function runSequential() {
  const start = performance.now();

  await simulateQuery('transactions');
  await simulateQuery('transactions');
  await simulateQuery('failed_transactions');
  await simulateQuery('profiles');
  await simulateQuery('profiles');
  await simulateQuery('profiles');
  await simulateQuery('withdrawals');
  await simulateQuery('transactions');
  await simulateQuery('transactions');
  await simulateQuery('failed_transactions');
  await simulateQuery('settings');
  await simulateQuery('transactions');
  await simulateQuery('transaction_items');
  await simulateQuery('transactions');

  return performance.now() - start;
}

async function runParallel() {
  const start = performance.now();

  await Promise.all([
    simulateQuery('transactions'),
    simulateQuery('transactions'),
    simulateQuery('failed_transactions'),
    simulateQuery('profiles'),
    simulateQuery('profiles'),
    simulateQuery('profiles'),
    simulateQuery('withdrawals'),
    simulateQuery('transactions'),
    simulateQuery('transactions'),
    simulateQuery('failed_transactions'),
    simulateQuery('settings'),
    simulateQuery('transactions'),
    simulateQuery('transaction_items'),
    simulateQuery('transactions')
  ]);

  return performance.now() - start;
}

async function main() {
  console.log('Running sequential (simulated delay 50ms per query)...');
  const seqTime = await runSequential();
  console.log(`Sequential: ${seqTime.toFixed(2)}ms`);

  console.log('Running parallel (simulated delay 50ms per query)...');
  const parTime = await runParallel();
  console.log(`Parallel: ${parTime.toFixed(2)}ms`);

  console.log(`Improvement: ${((seqTime - parTime) / seqTime * 100).toFixed(2)}%`);
}

main().catch(console.error);
