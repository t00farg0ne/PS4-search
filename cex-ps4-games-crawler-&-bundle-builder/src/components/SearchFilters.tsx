import React from 'react';
import { Search, X, SlidersHorizontal, ArrowUpDown, Filter, LayoutGrid, List, ListPlus } from 'lucide-react';
import { SortOption } from '../types';

interface SearchFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  inStockOnly: boolean;
  onInStockToggle: () => void;
  minPrice: string;
  maxPrice: string;
  onMinPriceChange: (v: string) => void;
  onMaxPriceChange: (v: string) => void;
  onResetFilters: () => void;
  viewMode: 'table' | 'grid';
  onViewModeChange: (mode: 'table' | 'grid') => void;
  totalHits: number;
  onOpenBulkModal: () => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  inStockOnly,
  onInStockToggle,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  onResetFilters,
  viewMode,
  onViewModeChange,
  totalHits,
  onOpenBulkModal,
}) => {
  const hasActiveFilters = searchQuery || inStockOnly || minPrice || maxPrice || sortBy !== 'relevance';

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Bar & Bulk Add Button */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="game-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search PS4 titles (e.g. GTA V, Spider-Man, God of War, Red Dead)..."
              className="w-full pl-10 pr-9 py-2 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder-slate-400 transition"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            id="filter-bulk-search-btn"
            type="button"
            onClick={onOpenBulkModal}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 rounded-lg text-xs font-semibold shadow-xs shrink-0 transition"
            title="Search for multiple titles from a list and add them in bulk"
          >
            <ListPlus className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Bulk Add List</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Sort Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-slate-500 font-medium">Sort:</span>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-hidden text-xs cursor-pointer"
            >
              <option value="relevance">Popularity / Relevance</option>
              <option value="price_asc">Buy Price: Low to High</option>
              <option value="price_desc">Buy Price: High to Low</option>
              <option value="voucher_desc">Voucher Trade-in: Highest</option>
              <option value="cash_desc">Cash Trade-in: Highest</option>
              <option value="ratio_desc">Best Trade-in Value Ratio (%)</option>
              <option value="name_asc">Title: A to Z</option>
              <option value="name_desc">Title: Z to A</option>
            </select>
          </div>

          {/* Price Range inputs */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <span className="text-slate-500 font-medium">Price:</span>
            <span className="text-slate-400">£</span>
            <input
              id="min-price-input"
              type="number"
              min="0"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => onMinPriceChange(e.target.value)}
              className="w-12 bg-white px-1.5 py-0.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-red-500 outline-hidden"
            />
            <span className="text-slate-400">-</span>
            <span className="text-slate-400">£</span>
            <input
              id="max-price-input"
              type="number"
              min="0"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => onMaxPriceChange(e.target.value)}
              className="w-12 bg-white px-1.5 py-0.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-red-500 outline-hidden"
            />
          </div>

          {/* In Stock Toggle */}
          <button
            id="in-stock-toggle"
            onClick={onInStockToggle}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer ${
              inStockOnly
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${inStockOnly ? 'bg-emerald-500' : 'bg-slate-400'}`}
            />
            <span>In Stock Only</span>
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
            <button
              onClick={() => onViewModeChange('table')}
              className={`p-1.5 transition ${
                viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 transition ${
                viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              id="reset-filters-btn"
              onClick={onResetFilters}
              className="text-slate-500 hover:text-red-600 underline font-medium ml-1 cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Sub-header Result Count */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing <span className="font-bold text-slate-800">{totalHits.toLocaleString()}</span> PS4 games
          {searchQuery && (
            <span>
              {' '}
              matching &quot;<span className="font-semibold text-slate-700">{searchQuery}</span>&quot;
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-400">
          CeX UK PlayStation 4 Software (Category ID: 1003)
        </div>
      </div>
    </div>
  );
};
