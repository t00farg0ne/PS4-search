import React from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  Download,
  Copy,
  Check,
  Coins,
  CreditCard,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  ListPlus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react';
import { BundleItem, BundleTotals } from '../types';

interface BundleBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  bundle: BundleItem[];
  totals: BundleTotals;
  onUpdateQuantity: (gameId: string, delta: number) => void;
  onRemoveItem: (gameId: string) => void;
  onClearBundle: () => void;
  onExportBundleCsv: () => void;
  onOpenBulkModal: () => void;
  onSyncPrices?: () => void;
  isSyncingPrices?: boolean;
  lastCatalogueRefresh?: string | null;
}

export const BundleBuilder: React.FC<BundleBuilderProps> = ({
  isOpen,
  onClose,
  bundle,
  totals,
  onUpdateQuantity,
  onRemoveItem,
  onClearBundle,
  onExportBundleCsv,
  onOpenBulkModal,
  onSyncPrices,
  isSyncingPrices = false,
  lastCatalogueRefresh,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopySummary = () => {
    if (bundle.length === 0) return;

    const lines = [
      '🎮 CeX PlayStation 4 Games Bundle Summary',
      `Total Games: ${totals.totalItems} (${totals.uniqueTitles} unique titles)`,
      '----------------------------------------',
      ...bundle.map(
        (item) =>
          `• ${item.quantity}x ${item.game.boxName} | Buy: £${(item.game.buyPrice * item.quantity).toFixed(
            2
          )} | Voucher: £${(item.game.voucherPrice * item.quantity).toFixed(2)} | Cash: £${(
            item.game.cashPrice * item.quantity
          ).toFixed(2)}`
      ),
      '----------------------------------------',
      `TOTAL BUY PRICE: £${totals.totalBuyPrice.toFixed(2)}`,
      `TOTAL TRADE-IN VOUCHER: £${totals.totalVoucherPrice.toFixed(2)}`,
      `TOTAL TRADE-IN CASH: £${totals.totalCashPrice.toFixed(2)}`,
      `Voucher Value Retention: ${totals.voucherRetentionRate.toFixed(1)}%`,
      `Cash Value Retention: ${totals.cashRetentionRate.toFixed(1)}%`,
      '----------------------------------------',
      `Source: CeX UK Playstation4 Software (uk.webuy.com)`,
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity">
      <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-sm">
              CeX
            </div>
            <div>
              <h2 className="text-base font-bold">Bundle Builder</h2>
              <p className="text-xs text-slate-400">
                {totals.totalItems} {totals.totalItems === 1 ? 'game' : 'games'} selected (
                {totals.uniqueTitles} unique)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close bundle drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Totals Summary Cards (Core Requirement) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Collection Price Totals
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* 1. Buy Price Total */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center space-x-1 text-slate-500 text-[11px] font-medium mb-1">
                <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                <span>Buy Price</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-slate-900 leading-tight">
                £{totals.totalBuyPrice.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">CeX WeSell Total</div>
            </div>

            {/* 2. Voucher Price Total */}
            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs bg-emerald-50/20">
              <div className="flex items-center space-x-1 text-emerald-700 text-[11px] font-medium mb-1">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>Voucher Total</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-emerald-700 leading-tight">
                £{totals.totalVoucherPrice.toFixed(2)}
              </div>
              <div className="text-[10px] text-emerald-600 mt-0.5">
                {totals.voucherRetentionRate.toFixed(1)}% of buy value
              </div>
            </div>

            {/* 3. Cash Price Total */}
            <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs bg-amber-50/20">
              <div className="flex items-center space-x-1 text-amber-700 text-[11px] font-medium mb-1">
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                <span>Cash Total</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-amber-700 leading-tight">
                £{totals.totalCashPrice.toFixed(2)}
              </div>
              <div className="text-[10px] text-amber-600 mt-0.5">
                {totals.cashRetentionRate.toFixed(1)}% of buy value
              </div>
            </div>
          </div>

          {/* Trade-in Trade-up Metric */}
          {totals.totalBuyPrice > 0 && (
            <div className="mt-3 px-3 py-2 bg-slate-100 rounded-lg flex items-center justify-between text-xs text-slate-600">
              <span>
                Voucher bonus over cash:{' '}
                <strong className="text-emerald-700 font-mono">
                  +£{(totals.totalVoucherPrice - totals.totalCashPrice).toFixed(2)}
                </strong>
              </span>
              <span className="text-[11px] text-slate-500">
                Net cost after voucher: £{(totals.totalBuyPrice - totals.totalVoucherPrice).toFixed(2)}
              </span>
            </div>
          )}

          {/* Sync Prices Bar */}
          {bundle.length > 0 && onSyncPrices && (
            <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-1.5 text-slate-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Auto-syncs with 24h CeX refresh</span>
                {lastCatalogueRefresh && (
                  <span className="text-slate-400">
                    ({new Date(lastCatalogueRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </span>
                )}
              </div>
              <button
                id="drawer-refresh-prices-btn"
                onClick={onSyncPrices}
                disabled={isSyncingPrices}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-medium transition cursor-pointer"
                title="Verify and update all bundle prices from CeX"
              >
                <RefreshCw className={`w-3 h-3 text-blue-600 ${isSyncingPrices ? 'animate-spin' : ''}`} />
                <span>{isSyncingPrices ? 'Updating...' : 'Update Prices Now'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Selected Games List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
          {bundle.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Your bundle is empty</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Click the &quot;Add&quot; button next to any PS4 game in the table, or paste an entire list to add games in bulk.
              </p>
              <button
                id="bundle-empty-bulk-add-btn"
                onClick={onOpenBulkModal}
                className="mt-4 flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-xs transition cursor-pointer"
              >
                <ListPlus className="w-4 h-4" />
                <span>Bulk Add from List</span>
              </button>
            </div>
          ) : (
            bundle.map(({ game, quantity, priceChanged, previousPrices, lastRefreshedAt }) => {
              const buyChanged = previousPrices && previousPrices.buyPrice !== game.buyPrice;
              const voucherChanged = previousPrices && previousPrices.voucherPrice !== game.voucherPrice;

              return (
                <div
                  key={game.id}
                  id={`bundle-item-${game.id}`}
                  className={`py-3 flex items-center space-x-3 group transition-colors rounded-lg px-1.5 ${
                    priceChanged ? 'bg-amber-50/50' : ''
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-11 h-14 shrink-0 rounded bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center p-0.5">
                    <img
                      src={game.imageUrl}
                      alt={game.boxName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://uk.webuy.com/static/icons/default-item-image.png';
                      }}
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-red-700">
                        {game.boxName}
                      </h4>
                      {priceChanged && (
                        <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-200 text-amber-900">
                          Price Updated
                        </span>
                      )}
                    </div>

                    {/* Stock Status Pill */}
                    <div className="flex items-center space-x-2 mt-0.5 text-[10px]">
                      {game.inStockOnline ? (
                        <span className="text-emerald-700 flex items-center space-x-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          <span>Online In Stock</span>
                        </span>
                      ) : game.inStockStore ? (
                        <span className="text-blue-700 flex items-center space-x-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                          <span>In {game.storesCount || 'Local'} Stores</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Out of Stock</span>
                      )}
                      {lastRefreshedAt && (
                        <span className="text-slate-400 text-[9px]">
                          • Refreshed {new Date(lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {/* 3 prices per item */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] font-mono">
                      <span className="text-slate-700" title="Buy Price">
                        Buy: £{(game.buyPrice * quantity).toFixed(2)}
                        {buyChanged && (
                          <span className="text-[10px] text-slate-400 ml-1">
                            (was £{(previousPrices.buyPrice * quantity).toFixed(2)})
                          </span>
                        )}
                      </span>
                      <span className="text-emerald-700 font-semibold" title="Voucher Trade-in Price">
                        Vch: £{(game.voucherPrice * quantity).toFixed(2)}
                        {voucherChanged && (
                          <span className="text-[10px] text-emerald-600 ml-1">
                            (was £{(previousPrices.voucherPrice * quantity).toFixed(2)})
                          </span>
                        )}
                      </span>
                      <span className="text-amber-700" title="Cash Trade-in Price">
                        Cash: £{(game.cashPrice * quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0">
                    <button
                      onClick={() => onUpdateQuantity(game.id, -1)}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                      title="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold font-mono">{quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(game.id, 1)}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                      title="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => onRemoveItem(game.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition cursor-pointer shrink-0"
                    title="Remove from bundle"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        {bundle.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
            <button
              onClick={onOpenBulkModal}
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-slate-900 text-amber-300 hover:bg-slate-800 flex items-center justify-center space-x-1.5 transition cursor-pointer"
            >
              <ListPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>Bulk Add More from List</span>
            </button>

            <div className="flex items-center space-x-2">
              {/* Copy Summary Button */}
              <button
                id="copy-bundle-btn"
                onClick={handleCopySummary}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Breakdown</span>
                  </>
                )}
              </button>

              {/* Export CSV Button */}
              <button
                id="export-bundle-csv-btn"
                onClick={onExportBundleCsv}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>

              {/* Clear Button */}
              <button
                id="clear-bundle-btn"
                onClick={onClearBundle}
                className="py-2 px-3 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-transparent transition cursor-pointer"
                title="Clear all items from bundle"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
