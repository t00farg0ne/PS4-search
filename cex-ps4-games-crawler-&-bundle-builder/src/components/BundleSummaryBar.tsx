import React from 'react';
import { Layers, ShoppingBag, CreditCard, Coins, ArrowRight } from 'lucide-react';
import { BundleTotals } from '../types';

interface BundleSummaryBarProps {
  totals: BundleTotals;
  onOpenBundle: () => void;
}

export const BundleSummaryBar: React.FC<BundleSummaryBarProps> = ({ totals, onOpenBundle }) => {
  if (totals.totalItems === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-3xl bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Items count */}
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-xs">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-bold leading-none">
            {totals.totalItems} {totals.totalItems === 1 ? 'Game' : 'Games'} in Bundle
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {totals.uniqueTitles} unique PlayStation 4 titles
          </div>
        </div>
      </div>

      {/* 3 Running Totals */}
      <div className="flex items-center space-x-4 sm:space-x-6">
        {/* Buy Total */}
        <div className="text-right">
          <div className="text-[10px] text-slate-400 uppercase font-medium">Buy Total</div>
          <div className="text-xs sm:text-sm font-bold font-mono text-white">
            £{totals.totalBuyPrice.toFixed(2)}
          </div>
        </div>

        {/* Voucher Total */}
        <div className="text-right">
          <div className="text-[10px] text-emerald-400 uppercase font-medium">Voucher</div>
          <div className="text-xs sm:text-sm font-bold font-mono text-emerald-400">
            £{totals.totalVoucherPrice.toFixed(2)}
          </div>
        </div>

        {/* Cash Total */}
        <div className="text-right hidden sm:block">
          <div className="text-[10px] text-amber-400 uppercase font-medium">Cash</div>
          <div className="text-xs sm:text-sm font-bold font-mono text-amber-400">
            £{totals.totalCashPrice.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Review Button */}
      <button
        id="floating-open-bundle-btn"
        onClick={onOpenBundle}
        className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-sm transition active:scale-95 cursor-pointer shrink-0"
      >
        <span>View Bundle</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
