import { useState, useMemo, memo, useCallback } from 'react';
import { useBag } from '@/contexts/BagContext';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { Product } from '@/types';
import { ShoppingBag, FileText, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { toast } from 'sonner';

type Category = 'all' | 'custom' | 'tees' | 'hoodies' | 'jerseys' | 'caps' | 'accessories' | 'rewards';

const StoreProductCard = memo(function StoreProductCard({
  product,
  isSelected,
  onSelect,
}: {
  product: Product;
  isSelected: boolean;
  onSelect: (id: string, colors?: string[]) => void;
}) {
  return (
    <div
      onClick={() => onSelect(product.id, product.colors)}
      className={`panel overflow-hidden cursor-pointer group transition-colors ${
        isSelected ? 'border-primary/50' : 'hover:border-border'
      }`}
    >
      <div className="relative aspect-square overflow-hidden bg-black/40">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 p-2"
          loading="lazy"
        />
        {product.badge && (
          <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-primary text-primary-foreground">
            {product.badge}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs font-medium truncate">{product.name}</p>
        <p className="stat-numeral text-sm text-primary mt-0.5">
          {product.is_custom ? 'Quote Request' : (product.price > 0 ? `$${product.price.toLocaleString()}` : 'Reward Item')}
        </p>
      </div>
    </div>
  );
});

const StorePage = () => {
  const { addToBag } = useBag();
  const [category, setCategory] = useState<Category>('all');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [selectedColor, setSelectedColor] = useState<string>('');

  // Custom Quote Dialog State
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ name: '', team: '', qty: '10', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productsQuery = useQuery({
    queryKey: ['public-products'],
    queryFn: () => apiFetch<{ ok: boolean; data: Product[] }>('/api/public/products'),
    retry: 1,
    staleTime: 60_000,
  });

  const products = useMemo<Product[]>(() => {
    const apiData = productsQuery.data?.data;
    if (Array.isArray(apiData)) return apiData;
    return [];
  }, [productsQuery.data]);

  // ⚡ Bolt Performance Optimization: Memoize the filtered array and detail lookup
  // This prevents expensive O(N) array traversals on every render, such as when
  // a user clicks to select a different product size or color.
  const filtered = useMemo(() => {
    return category === 'all' ? products : products.filter(p => p.category === category);
  }, [category, products]);

  const detail = useMemo(() => {
    return selectedProduct ? products.find(p => p.id === selectedProduct) : null;
  }, [selectedProduct, products]);

  const handleSelectProduct = useCallback((id: string, colors?: string[]) => {
    setSelectedProduct(id);
    if (colors?.length) {
      setSelectedColor(colors[0]);
    }
  }, []);

  const { session } = useAuth();

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;

    const token = session?.access_token ?? null;
    if (!token) {
      toast.error('Please sign in to submit a quote request.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch<{ ok: boolean; error?: string }>('/api/store/quote', {
        method: 'POST',
        headers: {
          'idempotency-key': crypto.randomUUID()
        },
        body: JSON.stringify({
          productId: detail.id,
          name: quoteForm.name,
          teamName: quoteForm.team,
          quantity: parseInt(quoteForm.qty, 10),
          notes: quoteForm.notes
        })
      }, token);

      if (res.ok) {
        toast.success('Quote request sent! The SBBL sales team will contact you shortly.');
        setIsQuoteDialogOpen(false);
        setQuoteForm({ name: '', team: '', qty: '10', notes: '' });
      } else {
        toast.error(res.error ?? 'Failed to submit quote request.');
      }
    } catch (err) {
      console.error(err); toast.error('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold">Official Store</h1>
          <p className="text-sm text-muted-foreground mt-1">Premium gear, rewards, and custom team kits</p>
        </div>

        {/* PIPA/PIPEDA Consent Banner will go here (Day 3) */}

        {productsQuery.isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : productsQuery.isError ? (
          <div className="text-center text-red-500 py-12">Failed to load store products.</div>
        ) : products.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">No products found.</div>
        ) : (
          <>
        {/* Categories */}
        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hidden pb-2">
          {(['all', 'custom', 'jerseys', 'hoodies', 'tees', 'caps', 'accessories', 'rewards'] as Category[]).map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm whitespace-nowrap transition-colors ${category === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:text-foreground'}`}>
              {c === 'all' ? 'All Items' : (c === 'custom' ? 'Custom Kits' : c)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product Grid */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filtered.map(p => (
                <StoreProductCard
                  key={p.id}
                  product={p}
                  isSelected={selectedProduct === p.id}
                  onSelect={handleSelectProduct}
                />
              ))}
            </div>
          </div>

          {/* Product Detail */}
          <div className="lg:col-span-1">
            {detail ? (
              <div className="panel p-4 sticky top-24 space-y-4">
                <div className="bg-black/40 rounded-sm p-4">
                  <img src={detail.image} alt={detail.name} className="w-full aspect-square object-contain" loading="lazy" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {detail.is_custom ? 'Custom Team Kit' : detail.category}
                  </p>
                  <h3 className="font-display text-lg font-bold mt-1">{detail.name}</h3>
                  {!detail.is_custom && (
                    <p className="stat-numeral text-2xl text-primary mt-2">{detail.price > 0 ? `$${detail.price.toLocaleString()}` : 'Reward Redemption'}</p>
                  )}
                </div>

                {detail.is_custom ? (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground space-y-2 border-l-2 border-primary/50 pl-3 py-1">
                      <p className="font-semibold text-foreground">Custom Team Jersey</p>
                      <p>Full sublimation • Microdex fabric • YS-4XL</p>
                      <p className="text-primary/90 mt-2 italic">Custom items require full analysis and quote by SBBL sales team.</p>
                      <p>Tap below to request your quote.</p>
                    </div>
                    <button onClick={() => setIsQuoteDialogOpen(true)} className="w-full gold-bg py-3 font-display font-bold text-sm uppercase tracking-wider rounded-sm inline-flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4" /> Request Custom Quote
                    </button>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            ) : (
              <div className="panel p-8 text-center sticky top-24">
                <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select an item to view details</p>
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </div>

      {/* Quote Request Dialog */}
      <Dialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen}>
        <DialogContent className="sm:max-w-md panel border-border">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider text-primary">Request Custom Quote</DialogTitle>
            <DialogDescription>
              Custom designs require review by the SBBL sales team. Enter your details below to begin the quoting process for the <strong className="text-foreground">{detail?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleQuoteSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Name</label>
              <input
                required
                type="text"
                className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                value={quoteForm.name}
                onChange={e => setQuoteForm({...quoteForm, name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team / Organization</label>
              <input
                required
                type="text"
                className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                value={quoteForm.team}
                onChange={e => setQuoteForm({...quoteForm, team: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estimated Quantity</label>
              <input
                required
                type="number"
                min="5"
                className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                value={quoteForm.qty}
                onChange={e => setQuoteForm({...quoteForm, qty: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Additional Notes</label>
              <textarea
                className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors min-h-[80px]"
                placeholder="Specific sizes, custom numbers, deadlines..."
                value={quoteForm.notes}
                onChange={e => setQuoteForm({...quoteForm, notes: e.target.value})}
              />
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              By submitting, you agree that SBBL may use these quote details to contact you about this custom order.
            </p>

            <div className="pt-4 flex justify-end gap-3">
              <DialogClose asChild>
                <button type="button" className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
              </DialogClose>
              <button
                type="submit"
                disabled={isSubmitting}
                className="gold-bg px-6 py-2 font-display font-bold text-sm uppercase tracking-wider rounded-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Sending...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StorePage;
