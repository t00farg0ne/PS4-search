import React from 'react';
import { Plus, Check, ExternalLink, Star, ShoppingCart, Info, TrendingUp } from 'lucide-react';
import { CexGame, BundleItem } from '../types';

interface GamesTableProps {
  games: CexGame[];
  bundle: BundleItem[];
  onAddToBundle: (game: CexGame) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  viewMode: 'table' | 'grid';
  onSelectGame?: (game: CexGame) => void;
}

export const GamesTable: React.FC<GamesTableProps> = ({
  games,
  bundle,
  onAddToBundle,
  currentPage,
  totalPages,
  onPageChange,
  isLoading,
  viewMode,
  onSelectGame,
}) => {
  // Map of game IDs to quantity in bundle
  const bundleQuantities = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of bundle) {
      map.set(item.game.id, item.quantity);
    }
    return map;
  }, [bundle]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-12 text-center">
        <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-700">Loading CeX PS4 games...</p>
        <p className="text-xs text-slate-400 mt-1">Fetching live prices from CeX UK database</p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
          <Info className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800">No PS4 games found</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Try adjusting your search keywords or clearing your price/stock filters to see all available PlayStation 4 titles.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
      {viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4 min-w-[240px]">Game Title</th>
                <th className="py-3 px-4 text-right min-w-[110px]">
                  <span className="block text-slate-800">CeX Buy Price</span>
                  <span className="text-[9px] text-slate-400 font-normal">WeSell for</span>
                </th>
                <th className="py-3 px-4 text-right min-w-[120px]">
                  <span className="block text-emerald-800">Voucher Trade-in</span>
                  <span className="text-[9px] text-emerald-600 font-normal">WeBuy Voucher</span>
                </th>
                <th className="py-3 px-4 text-right min-w-[110px]">
                  <span className="block text-amber-800">Cash Trade-in</span>
                  <span className="text-[9px] text-amber-600 font-normal">WeBuy Cash</span>
                </th>
                <th className="py-3 px-4 text-center min-w-[90px]">Voucher %</th>
                <th className="py-3 px-4 min-w-[120px]">Stock Status</th>
                <th className="py-3 px-4 text-center w-28">Bundle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {games.map((game, idx) => {
                const inBundle = bundleQuantities.get(game.id) || 0;
                const voucherRatio =
                  game.buyPrice > 0 ? Math.round((game.voucherPrice / game.buyPrice) * 100) : 0;
                const cashRatio =
                  game.buyPrice > 0 ? Math.round((game.cashPrice / game.buyPrice) * 100) : 0;

                return (
                  <tr
                    key={game.id}
                    id={`game-row-${game.id}`}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    {/* Index / Rank */}
                    <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                      {game.position ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          game.position <= 10
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : game.position <= 50
                            ? 'bg-slate-200 text-slate-800'
                            : 'text-slate-400'
                        }`}>
                          #{game.position}
                        </span>
                      ) : (
                        currentPage * 50 + idx + 1
                      )}
                    </td>

                    {/* Title & Cover */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="relative w-12 h-14 shrink-0 rounded bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                          <img
                            src={game.imageUrl}
                            alt={game.boxName}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-full h-full object-contain p-0.5"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://uk.webuy.com/static/icons/default-item-image.png';
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-red-700 transition-colors line-clamp-1">
                              {game.boxName}
                            </span>
                            <a
                              href={game.productUrl || `https://uk.webuy.com/product-detail?id=${game.id}`}
                              target="_blank"
                              rel="noreferrer"
                              title="View Buy Page on CeX"
                              className="text-slate-400 hover:text-red-600 transition shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-400">
                            <span className="font-mono text-[10px]">ID: {game.id}</span>
                            {game.pegi && game.pegi !== 'All' && (
                              <span className="px-1 py-0.2 bg-slate-100 border border-slate-200 rounded text-[9px] font-semibold text-slate-600">
                                PEGI {game.pegi}
                              </span>
                            )}
                            {game.rating > 0 && (
                              <span className="flex items-center text-amber-500 font-semibold text-[10px]">
                                <Star className="w-2.5 h-2.5 fill-current mr-0.5" />
                                {game.rating.toFixed(1)}
                              </span>
                            )}
                            <a
                              href={game.sellUrl || `https://uk.webuy.com/sell/product-detail?id=${game.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-emerald-600 hover:underline hidden sm:inline"
                              title="Direct CeX Trade-in Sell Link"
                            >
                              Trade-in Link ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Buy Price */}
                    <td className="py-3 px-4 text-right">
                      <div className="font-mono font-bold text-sm text-slate-900">
                        £{game.buyPrice.toFixed(2)}
                      </div>
                      {game.previousPrice > game.buyPrice && (
                        <div className="text-[10px] text-slate-400 line-through">
                          £{game.previousPrice.toFixed(2)}
                        </div>
                      )}
                    </td>

                    {/* Voucher Price */}
                    <td className="py-3 px-4 text-right">
                      <div className="font-mono font-bold text-sm text-emerald-700">
                        £{game.voucherPrice.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-medium">
                        +{voucherRatio}% value
                      </div>
                    </td>

                    {/* Cash Price */}
                    <td className="py-3 px-4 text-right">
                      <div className="font-mono font-bold text-sm text-amber-700">
                        £{game.cashPrice.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-amber-600 font-medium">
                        {cashRatio}% cash
                      </div>
                    </td>

                    {/* Voucher % */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                          voucherRatio >= 60
                            ? 'bg-emerald-100 text-emerald-800'
                            : voucherRatio >= 45
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {voucherRatio}%
                      </span>
                    </td>

                    {/* Stock Status */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              game.inStockOnline ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          />
                          <span
                            className={`text-[10px] ${
                              game.inStockOnline ? 'text-emerald-700 font-medium' : 'text-slate-400'
                            }`}
                          >
                            Online {game.inStockOnline ? `(${game.ecomQuantity || 'In Stock'})` : 'Out'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              game.inStockStore ? 'bg-blue-500' : 'bg-slate-300'
                            }`}
                          />
                          <span
                            className={`text-[10px] ${
                              game.inStockStore ? 'text-blue-700 font-medium' : 'text-slate-400'
                            }`}
                          >
                            {game.storesCount > 0 ? `${game.storesCount} Stores` : game.inStockStore ? 'In Store' : 'No Stores'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Add to Bundle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        id={`add-game-btn-${game.id}`}
                        onClick={() => onAddToBundle(game)}
                        className={`inline-flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer ${
                          inBundle > 0
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-100 hover:bg-red-600 hover:text-white text-slate-700'
                        }`}
                        title={inBundle > 0 ? `In bundle (${inBundle}x) - click to add another` : 'Add game to bundle list'}
                      >
                        {inBundle > 0 ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>In Bundle ({inBundle})</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {games.map((game) => {
            const inBundle = bundleQuantities.get(game.id) || 0;
            const voucherRatio =
              game.buyPrice > 0 ? Math.round((game.voucherPrice / game.buyPrice) * 100) : 0;

            return (
              <div
                key={game.id}
                id={`game-card-${game.id}`}
                className="group border border-slate-200 rounded-xl p-3 flex flex-col justify-between hover:border-red-400 hover:shadow-md transition bg-white"
              >
                <div>
                  <div className="relative aspect-3/4 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden mb-2 flex items-center justify-center">
                    {game.position && (
                      <span className={`absolute top-1.5 left-1.5 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs ${
                        game.position <= 10
                          ? 'bg-amber-400 text-amber-950 font-black'
                          : 'bg-slate-900/80 backdrop-blur-xs text-white'
                      }`}>
                        #{game.position}
                      </span>
                    )}
                    <img
                      src={game.imageUrl}
                      alt={game.boxName}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://uk.webuy.com/static/icons/default-item-image.png';
                      }}
                    />
                    <span className="absolute top-1.5 right-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      {voucherRatio}% Vch
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-1">
                    <h4 className="font-bold text-xs text-slate-900 line-clamp-2 leading-tight group-hover:text-red-700 transition flex-1">
                      {game.boxName}
                    </h4>
                    <a
                      href={game.productUrl || `https://uk.webuy.com/product-detail?id=${game.id}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Open on CeX"
                      className="text-slate-400 hover:text-red-600 transition shrink-0 p-0.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                    <span>ID: {game.id}</span>
                    <a
                      href={game.sellUrl || `https://uk.webuy.com/sell/product-detail?id=${game.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[9px] text-emerald-600 hover:underline"
                    >
                      Trade ↗
                    </a>
                  </div>
                </div>

                {/* Pricing Block */}
                <div className="mt-3 pt-2 border-t border-slate-100 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">Buy:</span>
                    <span className="font-mono font-bold text-slate-900">£{game.buyPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700">
                    <span className="text-[10px]">Voucher:</span>
                    <span className="font-mono font-bold">£{game.voucherPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-amber-700">
                    <span className="text-[10px]">Cash:</span>
                    <span className="font-mono font-bold">£{game.cashPrice.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={() => onAddToBundle(game)}
                    className={`w-full mt-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition cursor-pointer ${
                      inBundle > 0
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-slate-100 text-slate-800 hover:bg-red-600 hover:text-white'
                    }`}
                  >
                    {inBundle > 0 ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>In Bundle ({inBundle})</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        <span>Add to Bundle</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="border-t border-slate-200 px-4 py-3 bg-slate-50 flex items-center justify-between text-xs">
          <div className="text-slate-500">
            Page <span className="font-bold text-slate-800">{currentPage + 1}</span> of{' '}
            <span className="font-bold text-slate-800">{totalPages}</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              id="pagination-prev-btn"
              disabled={currentPage === 0}
              onClick={() => onPageChange(currentPage - 1)}
              className="px-3 py-1 rounded border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>

            {/* Jump direct page pills */}
            <div className="hidden sm:flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Keep active window around current page
                let p = currentPage - 2 + i;
                if (currentPage < 2) p = i;
                if (currentPage > totalPages - 3) p = totalPages - 5 + i;
                if (p < 0 || p >= totalPages) return null;

                return (
                  <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={`w-7 h-7 rounded text-xs font-semibold transition cursor-pointer ${
                      currentPage === p
                        ? 'bg-red-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p + 1}
                  </button>
                );
              })}
            </div>

            <button
              id="pagination-next-btn"
              disabled={currentPage >= totalPages - 1}
              onClick={() => onPageChange(currentPage + 1)}
              className="px-3 py-1 rounded border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
