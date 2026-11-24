export interface CexGame {
  id: string;
  position?: number;
  boxName: string;
  buyPrice: number;
  voucherPrice: number;
  cashPrice: number;
  imageUrl: string;
  rating: number;
  inStockOnline: boolean;
  inStockStore: boolean;
  ecomQuantity: number;
  collectionQuantity: number;
  pegi: string;
  firstPrice: number;
  previousPrice: number;
  categoryName: string;
  priceLastChanged?: string;
  storesCount: number;
  productUrl?: string;
  sellUrl?: string;
}

export interface BundleItem {
  game: CexGame;
  quantity: number;
  lastRefreshedAt?: string;
  priceChanged?: boolean;
  previousPrices?: {
    buyPrice: number;
    voucherPrice: number;
    cashPrice: number;
  };
}

export interface BundleTotals {
  totalBuyPrice: number;
  totalVoucherPrice: number;
  totalCashPrice: number;
  totalItems: number;
  uniqueTitles: number;
  voucherRetentionRate: number; // voucherPrice / buyPrice %
  cashRetentionRate: number;    // cashPrice / buyPrice %
}

export interface CrawlerStatus {
  isCrawling: boolean;
  totalFound: number;
  itemsCrawled: number;
  currentBucket: string;
  lastCrawledAt: string | null;
  error: string | null;
  stagedRefreshEnabled: boolean;
  currentStage: number;
  totalStages: number;
  stageStatusText: string;
  nextStageInSeconds: number | null;
  lastCycleCompletedAt: string | null;
  nextCycleInHours?: number | null;
}

export type SortOption =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'voucher_desc'
  | 'cash_desc'
  | 'ratio_desc'
  | 'name_asc'
  | 'name_desc';

export interface BulkMatchResultItem {
  id: string;
  inputQuery: string;
  cleanedQuery: string;
  status: 'matched' | 'multiple_matches' | 'not_found';
  selectedMatch: CexGame | null;
  candidates: CexGame[];
  matchScore: number;
  included: boolean;
  quantity: number;
}
