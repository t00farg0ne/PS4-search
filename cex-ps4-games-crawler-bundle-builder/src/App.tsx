import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { CrawlerStatusBar } from './components/CrawlerStatusBar';
import { SearchFilters } from './components/SearchFilters';
import { GamesTable } from './components/GamesTable';
import { BundleBuilder } from './components/BundleBuilder';
import { BundleSummaryBar } from './components/BundleSummaryBar';
import { BulkListModal } from './components/BulkListModal';
import { CexGame, BundleItem, BundleTotals, CrawlerStatus, SortOption } from './types';
import { CheckCircle2, Sparkles, X } from 'lucide-react';

const BUNDLE_STORAGE_KEY = 'cex_ps4_bundle_v1';

export default function App() {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Games & Pagination state
  const [games, setGames] = useState<CexGame[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Crawler status
  const [crawlerStatus, setCrawlerStatus] = useState<CrawlerStatus>({
    isCrawling: false,
    totalFound: 2708,
    itemsCrawled: 0,
    currentBucket: '',
    lastCrawledAt: null,
    error: null,
    stagedRefreshEnabled: true,
    currentStage: 1,
    totalStages: 30,
    stageStatusText: '24h Staged Refresh active (staggered to avoid rate limits)',
    nextStageInSeconds: null,
    lastCycleCompletedAt: null,
    nextCycleInHours: null,
  });

  // Bundle state
  const [bundle, setBundle] = useState<BundleItem[]>(() => {
    try {
      const saved = localStorage.getItem(BUNDLE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isBundleOpen, setIsBundleOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSyncingBundle, setIsSyncingBundle] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Persist bundle
  useEffect(() => {
    try {
      localStorage.setItem(BUNDLE_STORAGE_KEY, JSON.stringify(bundle));
    } catch {
      // ignore
    }
  }, [bundle]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(0);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch crawler status
  const fetchCrawlerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/cex/status');
      if (res.ok) {
        const data = await res.json();
        setCrawlerStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch crawler status:', err);
    }
  }, []);

  // Poll crawler status: every 1.5s if full crawl is running, or every 6s for staged countdown
  useEffect(() => {
    fetchCrawlerStatus();

    const intervalTime = crawlerStatus.isCrawling ? 1500 : 6000;
    const interval = setInterval(() => {
      fetchCrawlerStatus();
    }, intervalTime);

    return () => clearInterval(interval);
  }, [crawlerStatus.isCrawling, fetchCrawlerStatus]);

  // Synchronize bundle prices with latest CeX catalogue
  const syncBundlePrices = useCallback(
    async (forceLive = false, showFeedback = true) => {
      if (bundle.length === 0) return;

      setIsSyncingBundle(true);
      try {
        const res = await fetch('/api/cex/sync-bundle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: bundle.map((item) => ({
              gameId: item.game.id,
              quantity: item.quantity,
              previousPrices: item.previousPrices || {
                buyPrice: item.game.buyPrice,
                voucherPrice: item.game.voucherPrice,
                cashPrice: item.game.cashPrice,
              },
            })),
            forceLive,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.updatedItems && data.updatedItems.length > 0) {
            setBundle(data.updatedItems);
            if (data.hasChanges && showFeedback) {
              const diffText = data.priceChanges
                .slice(0, 2)
                .map((c: any) => `${c.boxName}: Buy £${c.newBuy} / Voucher £${c.newVoucher}`)
                .join(', ');
              setNotification(
                `Updated bundle prices! ${data.changesCount} ${
                  data.changesCount === 1 ? 'game price changed' : 'games had price changes'
                }. (${diffText}${data.priceChanges.length > 2 ? '...' : ''})`
              );
            } else if (showFeedback && forceLive) {
              setNotification('All items in your bundle are fully verified with CeX!');
            }
          }
        }
      } catch (err) {
        console.error('Failed to sync bundle prices:', err);
      } finally {
        setIsSyncingBundle(false);
      }
    },
    [bundle]
  );

  // Automatically update active bundle whenever crawler refreshes catalogue in background
  const prevLastCrawledRef = React.useRef(crawlerStatus.lastCrawledAt);
  useEffect(() => {
    if (
      prevLastCrawledRef.current &&
      crawlerStatus.lastCrawledAt &&
      prevLastCrawledRef.current !== crawlerStatus.lastCrawledAt &&
      bundle.length > 0
    ) {
      syncBundlePrices(false, true);
    }
    prevLastCrawledRef.current = crawlerStatus.lastCrawledAt;
  }, [crawlerStatus.lastCrawledAt, bundle.length, syncBundlePrices]);

  // Staged refresh controls
  const handleToggleStagedRefresh = async () => {
    try {
      const res = await fetch('/api/cex/staged-refresh/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !crawlerStatus.stagedRefreshEnabled }),
      });
      if (res.ok) {
        fetchCrawlerStatus();
      }
    } catch (err) {
      console.error('Failed to toggle staged refresh:', err);
    }
  };

  const handleRunNextStageNow = async () => {
    try {
      const res = await fetch('/api/cex/staged-refresh/run-now', { method: 'POST' });
      if (res.ok) {
        setNotification('Running next crawl stage immediately...');
        setTimeout(fetchCrawlerStatus, 1000);
      }
    } catch (err) {
      console.error('Failed to run next stage:', err);
    }
  };

  const handleResetCycle = async () => {
    try {
      const res = await fetch('/api/cex/staged-refresh/reset-cycle', { method: 'POST' });
      if (res.ok) {
        setNotification('Restarted 24-hour cycle from stage 1.');
        setTimeout(fetchCrawlerStatus, 1000);
      }
    } catch (err) {
      console.error('Failed to reset cycle:', err);
    }
  };

  // Fetch games list
  const fetchGames = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set('q', debouncedQuery);
      params.set('page', String(currentPage));
      params.set('limit', '50');
      params.set('sort', sortBy);
      if (inStockOnly) params.set('inStock', 'true');
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);

      // Prefer cached items when we have a good cache and no live search keyword
      if (crawlerStatus.itemsCrawled >= 500 && !debouncedQuery) {
        params.set('useCache', 'true');
      }

      const res = await fetch(`/api/cex/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setGames(data.hits || []);
        setTotalHits(data.total || 0);
        setTotalPages(data.nbPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch games:', err);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, currentPage, sortBy, inStockOnly, minPrice, maxPrice, crawlerStatus.itemsCrawled]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Trigger full crawl
  const handleStartCrawl = async () => {
    try {
      const res = await fetch('/api/cex/crawl', { method: 'POST' });
      if (res.ok) {
        setCrawlerStatus((prev) => ({ ...prev, isCrawling: true }));
        fetchCrawlerStatus();
      }
    } catch (err) {
      console.error('Failed to start crawl:', err);
    }
  };

  // Bundle operations
  const handleAddToBundle = (game: CexGame) => {
    setBundle((prev) => {
      const existing = prev.find((item) => item.game.id === game.id);
      if (existing) {
        return prev.map((item) =>
          item.game.id === game.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { game, quantity: 1 }];
    });
  };

  // Bulk add to bundle
  const handleBulkAddToBundle = (items: { game: CexGame; quantity: number }[], replace: boolean) => {
    if (replace) {
      setBundle(items);
    } else {
      setBundle((prev) => {
        const next = [...prev];
        for (const item of items) {
          const idx = next.findIndex((n) => n.game.id === item.game.id);
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              quantity: next[idx].quantity + item.quantity,
            };
          } else {
            next.push(item);
          }
        }
        return next;
      });
    }

    const totalQty = items.reduce((acc, i) => acc + i.quantity, 0);
    setNotification(
      `Added ${totalQty} ${totalQty === 1 ? 'game' : 'games'} (${items.length} unique) to your bundle!`
    );
    setTimeout(() => setNotification(null), 4500);
    setIsBundleOpen(true);
  };

  const handleUpdateQuantity = (gameId: string, delta: number) => {
    setBundle((prev) => {
      return prev
        .map((item) => {
          if (item.game.id === gameId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as BundleItem[];
    });
  };

  const handleRemoveItem = (gameId: string) => {
    setBundle((prev) => prev.filter((item) => item.game.id !== gameId));
  };

  const handleClearBundle = () => {
    if (window.confirm('Are you sure you want to clear your bundle?')) {
      setBundle([]);
    }
  };

  // Calculate totals
  const bundleTotals: BundleTotals = useMemo(() => {
    let totalBuyPrice = 0;
    let totalVoucherPrice = 0;
    let totalCashPrice = 0;
    let totalItems = 0;

    for (const item of bundle) {
      totalBuyPrice += item.game.buyPrice * item.quantity;
      totalVoucherPrice += item.game.voucherPrice * item.quantity;
      totalCashPrice += item.game.cashPrice * item.quantity;
      totalItems += item.quantity;
    }

    const voucherRetentionRate = totalBuyPrice > 0 ? (totalVoucherPrice / totalBuyPrice) * 100 : 0;
    const cashRetentionRate = totalBuyPrice > 0 ? (totalCashPrice / totalBuyPrice) * 100 : 0;

    return {
      totalBuyPrice,
      totalVoucherPrice,
      totalCashPrice,
      totalItems,
      uniqueTitles: bundle.length,
      voucherRetentionRate,
      cashRetentionRate,
    };
  }, [bundle]);

  // Export full catalog CSV
  const handleExportCsv = () => {
    window.location.href = '/api/cex/export';
  };

  // Export bundle specific CSV
  const handleExportBundleCsv = () => {
    if (bundle.length === 0) return;

    const headers = [
      'Box ID',
      'Title',
      'Quantity',
      'Unit Buy Price (£)',
      'Total Buy Price (£)',
      'Unit Voucher (£)',
      'Total Voucher (£)',
      'Unit Cash (£)',
      'Total Cash (£)',
    ];

    const rows = bundle.map((item) => [
      `"${item.game.id}"`,
      `"${item.game.boxName.replace(/"/g, '""')}"`,
      item.quantity,
      item.game.buyPrice.toFixed(2),
      (item.game.buyPrice * item.quantity).toFixed(2),
      item.game.voucherPrice.toFixed(2),
      (item.game.voucherPrice * item.quantity).toFixed(2),
      item.game.cashPrice.toFixed(2),
      (item.game.cashPrice * item.quantity).toFixed(2),
    ]);

    // Totals row
    rows.push([
      '"TOTALS"',
      '""',
      bundleTotals.totalItems,
      '""',
      bundleTotals.totalBuyPrice.toFixed(2),
      '""',
      bundleTotals.totalVoucherPrice.toFixed(2),
      '""',
      bundleTotals.totalCashPrice.toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cex-ps4-bundle-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSortBy('relevance');
    setInStockOnly(false);
    setMinPrice('');
    setMaxPrice('');
    setCurrentPage(0);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col antialiased">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-900 text-emerald-100 border border-emerald-700 px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2.5 animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{notification}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-emerald-300 hover:text-white p-0.5 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header */}
      <Header
        crawlerStatus={crawlerStatus}
        onStartCrawl={handleStartCrawl}
        bundleCount={bundleTotals.totalItems}
        bundleBuyTotal={bundleTotals.totalBuyPrice}
        onOpenBundle={() => setIsBundleOpen(true)}
        onOpenBulkModal={() => setIsBulkModalOpen(true)}
      />

      {/* 2. Crawler Progress & Metrics Banner */}
      <CrawlerStatusBar
        status={crawlerStatus}
        onStartCrawl={handleStartCrawl}
        onExportCsv={handleExportCsv}
        onDismissError={() => setCrawlerStatus((prev) => ({ ...prev, error: null }))}
        onToggleStagedRefresh={handleToggleStagedRefresh}
        onRunNextStageNow={handleRunNextStageNow}
        onResetCycle={handleResetCycle}
        onSyncBundle={() => syncBundlePrices(true, true)}
        isSyncingBundle={isSyncingBundle}
        bundleCount={bundleTotals.totalItems}
      />

      {/* 3. Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {/* Search & Filter Bar */}
        <SearchFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={(s) => {
            setSortBy(s);
            setCurrentPage(0);
          }}
          inStockOnly={inStockOnly}
          onInStockToggle={() => {
            setInStockOnly(!inStockOnly);
            setCurrentPage(0);
          }}
          minPrice={minPrice}
          maxPrice={maxPrice}
          onMinPriceChange={(v) => {
            setMinPrice(v);
            setCurrentPage(0);
          }}
          onMaxPriceChange={(v) => {
            setMaxPrice(v);
            setCurrentPage(0);
          }}
          onResetFilters={handleResetFilters}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          totalHits={totalHits}
          onOpenBulkModal={() => setIsBulkModalOpen(true)}
        />

        {/* Games Table or Grid */}
        <GamesTable
          games={games}
          bundle={bundle}
          onAddToBundle={handleAddToBundle}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          isLoading={isLoading}
          viewMode={viewMode}
        />
      </main>

      {/* 4. Bottom Sticky Summary Bar (when items are in bundle) */}
      <BundleSummaryBar
        totals={bundleTotals}
        onOpenBundle={() => setIsBundleOpen(true)}
      />

      {/* 5. Bundle Builder Drawer / Panel */}
      <BundleBuilder
        isOpen={isBundleOpen}
        onClose={() => setIsBundleOpen(false)}
        bundle={bundle}
        totals={bundleTotals}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearBundle={handleClearBundle}
        onExportBundleCsv={handleExportBundleCsv}
        onOpenBulkModal={() => setIsBulkModalOpen(true)}
        onSyncPrices={() => syncBundlePrices(true, true)}
        isSyncingPrices={isSyncingBundle}
        lastCatalogueRefresh={crawlerStatus.lastCrawledAt}
      />

      {/* 6. Bulk List Search & Importer Modal */}
      <BulkListModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onAddBulkToBundle={handleBulkAddToBundle}
        currentBundleCount={bundleTotals.totalItems}
      />
    </div>
  );
}
