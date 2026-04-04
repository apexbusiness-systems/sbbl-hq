import { useState, useMemo } from 'react';
import { products as mockProducts } from '@/data/mock';
import { useBag } from '@/contexts/BagContext';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { Product } from '@/types';
import { ShoppingBag, Filter } from 'lucide-react';

type Category = 'all' | 'tees' | 'hoodies' | 'jerseys' | 'caps' | 'accessories' | 'rewards';

const StorePage = () => {
  const { addToBag } = useBag();
  const [category, setCategory] = useState<Category>('all');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [selectedColor, setSelectedColor] = useState<string>('');

  const productsQuery = useQuery({
    queryKey: ['public-products'],
    queryFn: () => apiFetch<{ ok: boolean; data: Product[] }>('/api/public/products'),
    retry: 1,
    staleTime: 60_000,
  });

  const products = useMemo<Product[]>(() => {
    const apiData = productsQuery.data?.data;
    if (Array.isArray(apiData) && apiData.length > 0) return apiData;
    return mockProducts;
  }, [productsQuery.data]);

  const filtered = category === 'all' ? products : products.filter(p => p.category === category);
  const detail = selectedProduct ? products.find(p => p.id === selectedProduct) : null;

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold">Official Store</h1>
          <p className="text-sm text-muted-foreground mt-1">Premium gear and reward items</p>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hidden pb-2">
          {(['all', 'jerseys', 'hoodies', 'tees', 'caps', 'accessories', 'rewards'] as Category[]).map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm whitespace-nowrap transition-colors ${category === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:text-foreground'}`}>
              {c === 'all' ? 'All Items' : c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product Grid */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filtered.map(p => (
                <div key={p.id} onClick={() => { setSelectedProduct(p.id); if (p.colors?.length) setSelectedColor(p.colors[0]); }} className={`panel overflow-hidden cursor-pointer group transition-colors ${selectedProduct === p.id ? 'border-primary/50' : 'hover:border-border'}`}>
                  <div className="relative aspect-square overflow-hidden">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    {p.badge && (
                      <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-primary text-primary-foreground">{p.badge}</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    <p className="stat-numeral text-sm text-primary mt-0.5">{p.price > 0 ? `$${p.price.toLocaleString()}` : 'Reward Item'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Product Detail */}
          <div className="lg:col-span-1">
            {detail ? (
              <div className="panel p-4 sticky top-24 space-y-4">
                <img src={detail.image} alt={detail.name} className="w-full aspect-square object-cover rounded-sm" loading="lazy" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{detail.category}</p>
                  <h3 className="font-display text-lg font-bold mt-1">{detail.name}</h3>
                  <p className="stat-numeral text-2xl text-primary mt-2">{detail.price > 0 ? `$${detail.price.toLocaleString()}` : 'Reward Redemption'}</p>
                </div>
                {detail.sizes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Size</p>
                    <div className="flex gap-2 flex-wrap">
                      {detail.sizes.map(s => (
                        <button key={s} onClick={() => setSelectedSize(s)} className={`w-10 h-10 text-xs font-semibold rounded-sm transition-colors ${selectedSize === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {detail.colors && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Color</p>
                    <div className="flex gap-2 flex-wrap">
                      {detail.colors.map(c => (
                        <button key={c} onClick={() => setSelectedColor(c)} className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${selectedColor === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>{c}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => addToBag(detail.id)} className="w-full gold-bg py-3 font-display font-bold text-sm uppercase tracking-wider rounded-sm inline-flex items-center justify-center gap-2">
                  <ShoppingBag className="w-4 h-4" /> {detail.price > 0 ? 'Add to Bag' : 'Redeem with Points'}
                </button>
              </div>
            ) : (
              <div className="panel p-8 text-center">
                <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select an item to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorePage;
