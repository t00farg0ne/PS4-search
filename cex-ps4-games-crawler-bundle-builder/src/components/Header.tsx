import React from 'react';
import { ShoppingBag, RefreshCw, ExternalLink, Database, Layers, ListPlus } from 'lucide-react';
import { CrawlerStatus } from '../types';

interface HeaderProps {
  crawlerStatus: CrawlerStatus;
  onStartCrawl: () => void;
  bundleCount: number;
  bundleBuyTotal: number;
  onOpenBundle: () => void;
  onOpenBulkModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  crawlerStatus,
  onStartCrawl,
  bundleCount,
  bundleBuyTotal,
  onOpenBundle,
  onOpenBulkModal,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Branding & CeX Link */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center font-bold text-lg tracking-wider shadow-sm text-white">
            CeX
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-none">
                PS4 Games Price Crawler &amp; Bundle Builder
              </h1>
              <a
                href="https://uk.webuy.com/search?categoryIds=1003&categoryName=Playstation4%20Games"
                target="_blank"
                rel="noreferrer"
                title="Open PlayStation 4 Software on CeX UK"
                className="hidden md:inline-flex items-center space-x-1 text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
              >
                <span>CeX Category 1003</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block mt-0.5">
              Live crawler &amp; price tracker: Buy Price, Trade-In Voucher, and Trade-In Cash
            </p>
          </div>
        </div>

        {/* Right: Quick actions & Bundle summary badge */}
        <div className="flex items-center space-x-2.5">
          {/* Bulk Search Button */}
          <button
            id="header-bulk-search-btn"
            onClick={onOpenBulkModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 transition shadow-xs hover:border-amber-400"
            title="Paste a list of games to search and add in bulk"
          >
            <ListPlus className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Bulk Add List</span>
          </button>

          {/* Crawl Status Quick Pill */}
          <button
            onClick={onStartCrawl}
            disabled={crawlerStatus.isCrawling}
            title={crawlerStatus.isCrawling ? 'Crawl in progress...' : 'Trigger full catalogue crawl'}
            className={`hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              crawlerStatus.isCrawling
                ? 'bg-amber-950/60 border-amber-600/50 text-amber-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${crawlerStatus.isCrawling ? 'animate-spin text-amber-400' : 'text-slate-400'}`}
            />
            <span>
              {crawlerStatus.isCrawling
                ? `Crawling (${crawlerStatus.itemsCrawled}/${crawlerStatus.totalFound || 2708})`
                : crawlerStatus.itemsCrawled > 0
                ? `Crawled ${crawlerStatus.itemsCrawled} Titles`
                : 'Crawl CeX'}
            </span>
          </button>

          {/* Bundle Trigger Button */}
          <button
            id="open-bundle-btn"
            onClick={onOpenBundle}
            className="relative flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-all shadow-sm active:scale-95"
          >
            <Layers className="w-4 h-4" />
            <span>Bundle Builder</span>
            {bundleCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white text-red-700 text-[11px] font-extrabold">
                {bundleCount}
              </span>
            )}
            {bundleCount > 0 && (
              <span className="hidden lg:inline text-red-200 text-xs border-l border-red-500/50 pl-2">
                £{bundleBuyTotal.toFixed(2)}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
