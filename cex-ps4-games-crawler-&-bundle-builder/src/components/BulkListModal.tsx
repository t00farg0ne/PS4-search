import React, { useState } from 'react';
import {
  X,
  ListPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Trash2,
  Layers,
  Plus,
  Minus,
  Sparkles,
  ExternalLink,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { CexGame, BulkMatchResultItem } from '../types';

interface BulkListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBulkToBundle: (items: { game: CexGame; quantity: number }[], replace: boolean) => void;
  currentBundleCount: number;
}

const SAMPLE_LIST = [
  'Grand Theft Auto V',
  '1. Spider-Man (2018)',
  'God of War',
  '- Red Dead Redemption 2',
  'Crash Bandicoot N. Sane Trilogy',
  'The Last of Us Part II',
  'Bloodborne',
  'Minecraft PlayStation 4 Edition',
].join('\n');

export const BulkListModal: React.FC<BulkListModalProps> = ({
  isOpen,
  onClose,
  onAddBulkToBundle,
  currentBundleCount,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [matchResults, setMatchResults] = useState<BulkMatchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [addMode, setAddMode] = useState<'append' | 'replace'>('append');
  const [searchError, setSearchError] = useState<string | null>(null);

  // Parse lines count
  const linesCount = inputText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;

  const handleLoadSample = () => {
    setInputText(SAMPLE_LIST);
    setSearchError(null);
  };

  const handleClearInput = () => {
    setInputText('');
    setMatchResults([]);
    setHasSearched(false);
    setSearchError(null);
  };

  // Perform bulk search
  const handlePerformSearch = async () => {
    const lines = inputText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (lines.length === 0) {
      setSearchError('Please enter at least one game title or barcode.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await fetch('/api/cex/bulk-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lines }),
      });

      if (!res.ok) {
        throw new Error(`Search failed with status ${res.status}`);
      }

      const data = await res.json();
      const formattedResults: BulkMatchResultItem[] = (data.results || []).map(
        (r: any, idx: number) => ({
          id: `bulk-item-${idx}-${Date.now()}`,
          inputQuery: r.inputQuery,
          cleanedQuery: r.cleanedQuery,
          status: r.status,
          selectedMatch: r.selectedMatch,
          candidates: r.candidates || [],
          matchScore: r.matchScore || 0,
          included: r.selectedMatch !== null,
          quantity: 1,
        })
      );

      setMatchResults(formattedResults);
      setHasSearched(true);
    } catch (err: any) {
      console.error('Bulk search error:', err);
      setSearchError(err.message || 'Failed to search games on CeX.');
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle included
  const handleToggleInclude = (id: string) => {
    setMatchResults((prev) =>
      prev.map((item) => (item.id === id ? { ...item, included: !item.included } : item))
    );
  };

  // Toggle all
  const handleToggleAll = (include: boolean) => {
    setMatchResults((prev) =>
      prev.map((item) => (item.selectedMatch ? { ...item, included: include } : item))
    );
  };

  // Select different candidate
  const handleSelectCandidate = (itemId: string, candidate: CexGame) => {
    setMatchResults((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              selectedMatch: candidate,
              included: true,
              status: 'matched',
            }
          : item
      )
    );
  };

  // Update item quantity
  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setMatchResults((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  // Inline retry search for a single failed row
  const handleRetrySingleQuery = async (itemId: string, newQuery: string) => {
    try {
      const res = await fetch('/api/cex/bulk-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [newQuery] }),
      });
      if (res.ok) {
        const data = await res.json();
        const firstRes = data.results?.[0];
        if (firstRes) {
          setMatchResults((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    inputQuery: newQuery,
                    cleanedQuery: firstRes.cleanedQuery,
                    status: firstRes.status,
                    selectedMatch: firstRes.selectedMatch,
                    candidates: firstRes.candidates || [],
                    matchScore: firstRes.matchScore || 0,
                    included: firstRes.selectedMatch !== null,
                  }
                : item
            )
          );
        }
      }
    } catch (err) {
      console.error('Failed to retry item search:', err);
    }
  };

  // Calculate review totals
  const includedItems = matchResults.filter((m) => m.included && m.selectedMatch);
  const totalItemsCount = includedItems.reduce((acc, m) => acc + m.quantity, 0);
  const totalBuy = includedItems.reduce((acc, m) => acc + (m.selectedMatch?.buyPrice || 0) * m.quantity, 0);
  const totalVoucher = includedItems.reduce((acc, m) => acc + (m.selectedMatch?.voucherPrice || 0) * m.quantity, 0);
  const totalCash = includedItems.reduce((acc, m) => acc + (m.selectedMatch?.cashPrice || 0) * m.quantity, 0);

  // Commit to bundle
  const handleCommitToBundle = () => {
    const itemsToAdd = includedItems.map((m) => ({
      game: m.selectedMatch!,
      quantity: m.quantity,
    }));

    if (itemsToAdd.length === 0) return;

    onAddBulkToBundle(itemsToAdd, addMode === 'replace');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center font-bold text-white shadow-xs">
              <ListPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">Bulk List Search &amp; Bundle Importer</h2>
              <p className="text-xs text-slate-400">
                Paste your wishlist or inventory list to search CeX in bulk and add them to your bundle
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab / Step Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setHasSearched(false)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                !hasSearched
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Input List ({linesCount} {linesCount === 1 ? 'game' : 'games'})
            </button>
            <span className="text-slate-400">→</span>
            <button
              onClick={() => {
                if (matchResults.length > 0) setHasSearched(true);
              }}
              disabled={matchResults.length === 0}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                hasSearched
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : matchResults.length > 0
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 cursor-not-allowed'
              }`}
            >
              2. Review Matches ({matchResults.length} parsed)
            </button>
          </div>

          {hasSearched && (
            <button
              onClick={() => setHasSearched(false)}
              className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Edit List Input</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!hasSearched ? (
            /* STEP 1: Textarea Input */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="bulk-list-textarea" className="text-sm font-semibold text-slate-800">
                  Paste or type games (one per line):
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleLoadSample}
                    className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Load 8 Sample Games</span>
                  </button>
                  {inputText && (
                    <button
                      onClick={handleClearInput}
                      className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-red-600 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <textarea
                  id="bulk-list-textarea"
                  rows={10}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Paste your game titles here, one per line:\n\nGrand Theft Auto V\nSpider-Man (2018)\nGod of War\nRed Dead Redemption 2\nCrash Bandicoot N. Sane Trilogy\nThe Last of Us Part II\n5026555416986`}
                  className="w-full font-mono text-sm p-4 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-slate-50/50 transition resize-y"
                />
                <div className="absolute right-3 bottom-3 text-[11px] font-mono text-slate-400 bg-white/90 px-2 py-0.5 rounded border border-slate-200">
                  {linesCount} {linesCount === 1 ? 'title' : 'titles'} detected
                </div>
              </div>

              {/* Supported input guidance */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-slate-600">
                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-800">Game Titles:</span> Matches exact or partial PS4 titles across the CeX catalogue.
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-800">Barcodes / IDs:</span> Paste 12-digit barcodes or CeX box IDs for 100% exact matches.
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-800">Numbered Lists:</span> Formats like &quot;1. God of War&quot;, &quot;- GTA V&quot;, or CeX URLs are auto-cleaned.
                  </div>
                </div>
              </div>

              {searchError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: Results & Selection Review */
            <div className="space-y-4">
              {/* Stats overview banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{matchResults.filter((m) => m.status === 'matched').length} Exact / High Match</span>
                  </span>

                  {matchResults.some((m) => m.status === 'multiple_matches') && (
                    <span className="px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center space-x-1">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>
                        {matchResults.filter((m) => m.status === 'multiple_matches').length} Multiple Candidates
                      </span>
                    </span>
                  )}

                  {matchResults.some((m) => m.status === 'not_found') && (
                    <span className="px-2.5 py-1 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>{matchResults.filter((m) => m.status === 'not_found').length} Not Found</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <button
                    onClick={() => handleToggleAll(true)}
                    className="px-2.5 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => handleToggleAll(false)}
                    className="px-2.5 py-1 font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {matchResults.map((item, idx) => {
                  const game = item.selectedMatch;
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        !game
                          ? 'bg-rose-50/50 border-rose-200'
                          : item.included
                          ? 'bg-white border-slate-300 shadow-xs'
                          : 'bg-slate-50/80 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            checked={item.included && Boolean(game)}
                            disabled={!game}
                            onChange={() => handleToggleInclude(item.id)}
                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </div>

                        {/* Thumbnail */}
                        {game ? (
                          <div className="w-12 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                            <img
                              src={game.imageUrl}
                              alt={game.boxName}
                              loading="lazy"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://uk.webuy.com/static/icons/default-item-image.png';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-16 rounded-lg bg-rose-100 border border-rose-200 text-rose-500 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-5 h-5" />
                          </div>
                        )}

                        {/* Middle info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-mono text-slate-400">
                              #{idx + 1} Input: "{item.inputQuery}"
                            </span>
                            {game?.position && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                Rank #{game.position}
                              </span>
                            )}
                          </div>

                          {game ? (
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <h4 className="text-sm font-bold text-slate-900 truncate">
                                  {game.boxName}
                                </h4>
                                <a
                                  href={game.productUrl || `https://uk.webuy.com/product-detail?id=${game.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-slate-400 hover:text-red-600 shrink-0"
                                  title="View on CeX"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>

                              {/* Candidate selector if multiple were found */}
                              {item.candidates.length > 1 && (
                                <div className="mt-1.5 p-2 rounded-lg bg-amber-50/80 border border-amber-200 text-xs">
                                  <span className="font-semibold text-amber-900 block mb-1">
                                    Alternative CeX matches:
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.candidates.map((cand) => (
                                      <button
                                        key={cand.id}
                                        type="button"
                                        onClick={() => handleSelectCandidate(item.id, cand)}
                                        className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${
                                          game.id === cand.id
                                            ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-100'
                                        }`}
                                      >
                                        {cand.boxName} (£{cand.buyPrice.toFixed(2)})
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-rose-700">
                                No exact title match found on CeX PS4 database.
                              </p>
                              {/* Quick inline search correction */}
                              <div className="flex items-center space-x-1.5">
                                <input
                                  type="text"
                                  defaultValue={item.cleanedQuery || item.inputQuery}
                                  placeholder="Try different spelling or keyword..."
                                  id={`retry-input-${item.id}`}
                                  className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 w-64 focus:outline-hidden focus:ring-1 focus:ring-red-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const input = document.getElementById(
                                      `retry-input-${item.id}`
                                    ) as HTMLInputElement;
                                    if (input && input.value) {
                                      handleRetrySingleQuery(item.id, input.value);
                                    }
                                  }}
                                  className="px-2.5 py-1 text-xs bg-slate-800 text-white rounded font-medium hover:bg-slate-700"
                                >
                                  Retry
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right side: Prices & Quantity Stepper */}
                        {game && (
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <div className="flex items-center space-x-2 text-right">
                              <div>
                                <div className="text-[10px] text-slate-400 font-medium uppercase">Buy</div>
                                <div className="text-xs sm:text-sm font-bold text-slate-900">
                                  £{(game.buyPrice * item.quantity).toFixed(2)}
                                </div>
                              </div>
                              <div className="pl-2 border-l border-slate-200 hidden sm:block">
                                <div className="text-[10px] text-amber-600 font-medium uppercase">Voucher</div>
                                <div className="text-xs font-bold text-amber-700">
                                  £{(game.voucherPrice * item.quantity).toFixed(2)}
                                </div>
                              </div>
                              <div className="pl-2 border-l border-slate-200 hidden sm:block">
                                <div className="text-[10px] text-emerald-600 font-medium uppercase">Cash</div>
                                <div className="text-xs font-bold text-emerald-700">
                                  £{(game.cashPrice * item.quantity).toFixed(2)}
                                </div>
                              </div>
                            </div>

                            {/* Quantity stepper */}
                            <div className="flex items-center space-x-1 border border-slate-200 rounded-lg bg-slate-50 p-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.id, -1)}
                                disabled={item.quantity <= 1}
                                className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-30"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-6 text-center text-xs font-bold font-mono">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.id, 1)}
                                className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-800"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer / Action Bar */}
        <div className="p-4 sm:px-6 bg-slate-900 text-white border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {!hasSearched ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-400">
                {linesCount > 0
                  ? `Ready to search ${linesCount} ${linesCount === 1 ? 'game' : 'games'} across CeX UK`
                  : 'Enter games above to begin bulk search'}
              </span>
              <button
                id="bulk-search-submit-btn"
                onClick={handlePerformSearch}
                disabled={isSearching || linesCount === 0}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer disabled:cursor-not-allowed"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Searching CeX...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Find &amp; Match {linesCount > 0 ? `${linesCount} Games` : 'Games'}</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              {/* Bundle summary calculation */}
              <div className="flex items-center space-x-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Selected Games</span>
                  <span className="text-sm font-bold text-white">
                    {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'} ({includedItems.length} unique)
                  </span>
                </div>
                <div className="border-l border-slate-700 pl-4">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Buy Total</span>
                  <span className="text-sm font-bold text-white">£{totalBuy.toFixed(2)}</span>
                </div>
                <div className="border-l border-slate-700 pl-4 hidden sm:block">
                  <span className="text-amber-400 block text-[10px] uppercase font-semibold">Voucher</span>
                  <span className="text-sm font-bold text-amber-300">£{totalVoucher.toFixed(2)}</span>
                </div>
                <div className="border-l border-slate-700 pl-4 hidden sm:block">
                  <span className="text-emerald-400 block text-[10px] uppercase font-semibold">Cash</span>
                  <span className="text-sm font-bold text-emerald-300">£{totalCash.toFixed(2)}</span>
                </div>
              </div>

              {/* Add options & commit button */}
              <div className="flex items-center space-x-3">
                {currentBundleCount > 0 && (
                  <select
                    value={addMode}
                    onChange={(e) => setAddMode(e.target.value as 'append' | 'replace')}
                    className="bg-slate-800 border border-slate-700 text-white rounded-lg text-xs px-2.5 py-2 font-medium focus:outline-hidden cursor-pointer"
                  >
                    <option value="append">Add to current bundle</option>
                    <option value="replace">Replace current bundle</option>
                  </select>
                )}

                <button
                  id="confirm-bulk-bundle-btn"
                  onClick={handleCommitToBundle}
                  disabled={includedItems.length === 0}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer disabled:cursor-not-allowed"
                >
                  <Layers className="w-4 h-4" />
                  <span>
                    Add {totalItemsCount} {totalItemsCount === 1 ? 'Game' : 'Games'} to Bundle (£
                    {totalBuy.toFixed(2)})
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
