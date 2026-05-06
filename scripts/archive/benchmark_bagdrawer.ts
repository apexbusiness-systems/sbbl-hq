import { performance } from 'perf_hooks';
import { products } from './src/data/mock'; // Need to check if this works, or mock it

// Create a large number of products and bag items for the benchmark
const NUM_PRODUCTS = 10000;
const NUM_BAG_ITEMS = 5000;

const mockProducts = Array.from({ length: NUM_PRODUCTS }, (_, i) => ({
  id: `prod_${i}`,
  name: `Product ${i}`,
  price: Math.random() * 100
}));

const bagItems = Array.from({ length: NUM_BAG_ITEMS }, () => `prod_${Math.floor(Math.random() * NUM_PRODUCTS)}`);

function baselineSubtotal() {
  return bagItems.reduce((sum, id) => {
    const product = mockProducts.find(p => p.id === id);
    return sum + (product?.price ?? 0);
  }, 0);
}

function optimizedSubtotal() {
  const productMap = mockProducts.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, typeof mockProducts[0]>);

  return bagItems.reduce((sum, id) => {
    const product = productMap[id];
    return sum + (product?.price ?? 0);
  }, 0);
}

// Warmup
for(let i=0; i<10; i++) { baselineSubtotal(); optimizedSubtotal(); }

let start = performance.now();
for(let i=0; i<100; i++) baselineSubtotal();
const baselineTime = performance.now() - start;

start = performance.now();
for(let i=0; i<100; i++) optimizedSubtotal();
const optimizedTime = performance.now() - start;

console.log(`Baseline (100 iterations): ${baselineTime.toFixed(2)} ms`);
console.log(`Optimized (100 iterations): ${optimizedTime.toFixed(2)} ms`);
console.log(`Improvement: ${(baselineTime / optimizedTime).toFixed(2)}x faster`);
