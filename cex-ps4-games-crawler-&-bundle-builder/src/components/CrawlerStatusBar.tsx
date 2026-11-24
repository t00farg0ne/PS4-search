import React from 'react';
import {
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { CrawlerStatus } from '../types';

interface CrawlerStatusBarProps {
  status: CrawlerStatus;
  onStartCrawl: () => void;
  onExportCsv: () => void;
  onDismissError?: () => void;
  onToggleStagedRefresh?: () => void;
  onRunNextStageNow?: () => void;
  onResetCycle?: () => void;
  onSyncBundle?: () => void;
  isSyncingBundle?: boolean;
  bundleCount?: number;
}

export const CrawlerStatusBar: React.FC<CrawlerStatusBarProps> = ({
  status,
  onStartCrawl,
  onExportCsv,
  onDismissError,
  onToggleStagedRefresh,
  onRunNextStageNow,
  onResetCycle,
  onSyncBundle,
  isSyncingBundle = false,
  bundleCount = 0,
}) => {
  const total = status.totalFound || 2708;
  const progress = total > 0 ? Math.min(100, Math.round((status.itemsCrawled / total) * 100)) : 0;

  const handleDismiss = async () => {
    try {
      await fetch('/api/cex/clear-error', { method: 'POST' });
    } catch {
      // ignore
    }
    if (onDismissError) {
      onDismissError();
    }
  };

  const isRateLimit =
    status.error &&
    (status.error.toLowerCase().includes('rate limit') ||
      status.error.includes('429') ||
      status.error.includes('1015'));

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* If manual full crawl is actively running */}
        {status.isCrawling ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span className="font-semibold text-amber-300">
                  Crawling CeX PS4 Database ({status.currentBucket || 'Scanning brackets'}):
                </span>
                <span className="text-slate-300">
                  {status.itemsCrawled.toLocaleString()} of {total.toLocaleString()} titles retrieved ({progress}%)
                </span>
              </div>
              <span className="text-slate-400 font-mono text-[11px]">{progress}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-amber-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          /* Staged 24-Hour Refresh Status & Actions */
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
              {/* Database loaded count badge */}
              <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {status.itemsCrawled >= 1000
                    ? `${status.itemsCrawled.toLocaleString()} PS4 Titles Loaded (Top 1,000 Verified)`
                    : status.itemsCrawled > 0
                    ? `${status.itemsCrawled.toLocaleString()} PS4 Titles Indexed`
                    : 'CeX Algolia Engine Connected'}
                </span>
              </div>

              {/* 24-Hour Staged Refresh State Badge */}
              <div className="flex items-center space-x-2 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1 rounded-md text-[11px]">
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status.stagedRefreshEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                    }`}
                  />
                  <Clock className="w-3 h-3 text-indigo-300" />
                  <span className="font-medium text-slate-200">
                    {status.stagedRefreshEnabled ? '24h Staged Refresh:' : '24h Refresh:'}
                  </span>
                </div>

                {status.stagedRefreshEnabled ? (
                  <span className="text-indigo-300 font-mono">
                    Stage {status.currentStage || 1}/{status.totalStages || 30}
                    {typeof status.nextStageInSeconds === 'number' && status.nextStageInSeconds > 0
                      ? ` (next in ${status.nextStageInSeconds}s)`
                      : ' (active)'}
                  </span>
                ) : (
                  <span className="text-slate-400">Paused</span>
                )}

                {status.nextCycleInHours && status.nextCycleInHours > 0 && (
                  <span className="text-slate-400 text-[10px] hidden sm:inline">
                    • Next 24h cycle in ~{status.nextCycleInHours}h
                  </span>
                )}
              </div>

              {status.lastCrawledAt && (
                <span className="text-slate-400 text-[11px] hidden sm:inline">
                  Updated: {new Date(status.lastCrawledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Bundle Price Sync Button */}
              {bundleCount > 0 && onSyncBundle && (
                <button
                  id="sync-bundle-prices-btn"
                  onClick={onSyncBundle}
                  disabled={isSyncingBundle}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700 font-medium transition cursor-pointer"
                  title="Update active bundle items to latest refreshed CeX prices"
                >
                  <RefreshCw className={`w-3 h-3 text-blue-300 ${isSyncingBundle ? 'animate-spin' : ''}`} />
                  <span>{isSyncingBundle ? 'Syncing Bundle...' : `Update Bundle Prices (${bundleCount})`}</span>
                </button>
              )}

              {/* Staged Toggle Pause / Resume */}
              {onToggleStagedRefresh && (
                <button
                  id="toggle-staged-refresh-btn"
                  onClick={onToggleStagedRefresh}
                  className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer text-[11px]"
                  title={
                    status.stagedRefreshEnabled
                      ? 'Pause the background 24h staged refresh'
                      : 'Resume 24h staged refresh (1 stage per 60s, completely avoiding rate limits)'
                  }
                >
                  {status.stagedRefreshEnabled ? (
                    <>
                      <Pause className="w-3 h-3 text-amber-400" />
                      <span>Pause 24h</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 text-emerald-400" />
                      <span>Resume 24h</span>
                    </>
                  )}
                </button>
              )}

              {/* Run Next Stage Now */}
              {onRunNextStageNow && status.stagedRefreshEnabled && (
                <button
                  id="run-stage-now-btn"
                  onClick={onRunNextStageNow}
                  className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer text-[11px]"
                  title="Run next scheduled stage immediately without waiting"
                >
                  <FastForward className="w-3 h-3 text-indigo-400" />
                  <span>Run Stage Now</span>
                </button>
              )}

              {/* Download Verified 1,000 CSV */}
              <a
                id="download-1000-dataset-btn"
                href="/api/cex/dataset/csv"
                download="cex_ps4_dataset_1000.csv"
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700 font-medium transition text-[11px]"
                title="Download verified 1,000 PS4 Titles Dataset (CSV format)"
              >
                <Download className="w-3 h-3 text-red-300" />
                <span>1,000 CSV</span>
              </a>

              {/* Export Active Table CSV */}
              <button
                id="export-csv-btn"
                onClick={onExportCsv}
                className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium transition cursor-pointer text-[11px]"
                title="Export current table view to CSV"
              >
                <Download className="w-3 h-3 text-slate-400" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        )}

        {/* Informational Sub-Banner: Explaining rate limit solution */}
        <div className="mt-2 text-[10px] text-slate-400 flex flex-wrap items-center justify-between gap-1 border-t border-slate-800/80 pt-1.5">
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>
              <strong className="text-slate-300">Rate Limit Safe:</strong> 24h Staged Refresh paces Algolia queries 60 seconds apart across price brackets, refreshing all 2,700+ PS4 titles without Cloudflare 1015 triggers.
            </span>
          </div>
          <span className="text-slate-400 italic font-mono">
            {status.stageStatusText || 'Staged engine active'}
          </span>
        </div>

        {status.error && (
          <div
            className={`mt-2 flex items-center justify-between text-xs p-2.5 rounded border ${
              isRateLimit
                ? 'text-amber-300 bg-amber-950/60 border-amber-800/60'
                : 'text-red-300 bg-red-950/60 border-red-800/60'
            }`}
          >
            <div className="flex items-center space-x-2 min-w-0 pr-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span className="truncate">
                {isRateLimit
                  ? 'CeX rate limit encountered. 24h Staged Refresh has automatically paused for 3 minutes to clear cooldown. All titles in catalogue and bundle are completely preserved.'
                  : `Crawl status: ${status.error}`}
              </span>
            </div>
            <div className="flex items-center space-x-3 shrink-0">
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800 text-[11px]"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
