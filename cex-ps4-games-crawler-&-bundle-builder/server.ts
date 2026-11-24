import express from 'express';
import path from 'path';
import https from 'https';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// CeX PlayStation 4 Software configuration
const CEX_ALGOLIA_HOST = 'search.webuy.io';
const CEX_APP_ID = 'LNNFEEWZVA';
const CEX_API_KEY = 'bf79f2b6699e60a18ae330a1248b452c';
const PS4_CATEGORY_ID = '1003';

export interface CexRawHit {
  boxId: string;
  boxName: string;
  sellPrice: number;
  cashPriceCalculated?: number;
  cashBuyPrice?: number;
  cashPrice?: number;
  exchangePriceCalculated?: number;
  exchangePrice?: number;
  rating?: number;
  imageUrls?: {
    small?: string;
    medium?: string;
    large?: string;
  };
  inStockOnline?: number;
  inStockStore?: number;
  ecomQuantity?: number;
  collectionQuantity?: number;
  'PEGI Certificate'?: string[];
  firstPrice?: number;
  previousPrice?: number;
  categoryName?: string;
  categoryFriendlyName?: string;
  priceLastChanged?: string;
  stores?: string[];
}

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

// In-memory crawler store & 24h staged refresh scheduler
const LIVE_CATALOGUE_PATH = path.join(process.cwd(), 'src', 'data', 'cex_catalogue_live.json');

interface CrawlerState {
  isCrawling: boolean;
  totalFound: number;
  itemsCrawled: number;
  currentBucket: string;
  lastCrawledAt: string | null;
  error: string | null;
  hasSeedDataset: boolean;
  stagedRefreshEnabled: boolean;
  currentStage: number;
  totalStages: number;
  stageStatusText: string;
  nextStageRunAt: number | null;
  lastCycleCompletedAt: string | null;
  nextCycleRunAt: number | null;
}

const BUCKET_CONFIGS = [
  { label: 'Under £5', filter: '["sellPrice<5"]', pages: 2 },
  { label: '£5 - £9.99', filter: '["sellPrice>=5","sellPrice<10"]', pages: 8 },
  { label: '£10 - £14.99', filter: '["sellPrice>=10","sellPrice<15"]', pages: 6 },
  { label: '£15 - £21.99', filter: '["sellPrice>=15","sellPrice<22"]', pages: 6 },
  { label: '£22 - £34.99', filter: '["sellPrice>=22","sellPrice<35"]', pages: 4 },
  { label: '£35 and above', filter: '["sellPrice>=35"]', pages: 4 },
];

export interface StageDefinition {
  stageIndex: number;
  bucketLabel: string;
  bucketFilter: string;
  page: number;
}

const STAGES: StageDefinition[] = [];
let sCount = 0;
for (const b of BUCKET_CONFIGS) {
  for (let p = 0; p < b.pages; p++) {
    STAGES.push({
      stageIndex: sCount++,
      bucketLabel: b.label,
      bucketFilter: b.filter,
      page: p,
    });
  }
}

const STAGE_INTERVAL_MS = 60 * 1000; // 60s per stage to strictly guarantee zero Cloudflare 1015 rate limit
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const crawlerState: CrawlerState = {
  isCrawling: false,
  totalFound: 2708,
  itemsCrawled: 0,
  currentBucket: '',
  lastCrawledAt: null,
  error: null,
  hasSeedDataset: false,
  stagedRefreshEnabled: true,
  currentStage: 0,
  totalStages: STAGES.length,
  stageStatusText: '24h Staged Refresh active (1 stage every 60s to prevent rate limits)',
  nextStageRunAt: Date.now() + 45000, // first background stage runs 45s after boot
  lastCycleCompletedAt: null,
  nextCycleRunAt: null,
};

const gamesCache = new Map<string, CexGame>();

function persistCatalogueToDisk() {
  try {
    const data = Array.from(gamesCache.values());
    fs.writeFileSync(LIVE_CATALOGUE_PATH, JSON.stringify(data), 'utf8');
  } catch (err) {
    console.warn('[Persistence] Could not save live catalogue:', err);
  }
}

// Map raw CeX hit to standardized CexGame
function formatGame(hit: CexRawHit, position?: number): CexGame {
  const sellPrice = Number(hit.sellPrice || 0);
  const voucherPrice = Number(hit.exchangePriceCalculated ?? hit.exchangePrice ?? 0);
  const cashPrice = Number(hit.cashPriceCalculated ?? hit.cashBuyPrice ?? hit.cashPrice ?? 0);

  const imageUrl =
    hit.imageUrls?.large ||
    hit.imageUrls?.medium ||
    hit.imageUrls?.small ||
    `https://uk.static.webuy.com/product_images/Gaming/Playstation4 Software/${hit.boxId}_l.jpg`;

  const pegiList = hit['PEGI Certificate'];
  const pegi = Array.isArray(pegiList) && pegiList.length > 0 ? pegiList[0] : 'All';

  return {
    id: hit.boxId,
    position,
    boxName: hit.boxName || 'Unknown Title',
    buyPrice: sellPrice,
    voucherPrice,
    cashPrice,
    imageUrl,
    rating: Number(hit.rating || 0),
    inStockOnline: Boolean(hit.inStockOnline),
    inStockStore: Boolean(hit.inStockStore),
    ecomQuantity: Number(hit.ecomQuantity || 0),
    collectionQuantity: Number(hit.collectionQuantity || 0),
    pegi,
    firstPrice: Number(hit.firstPrice || sellPrice),
    previousPrice: Number(hit.previousPrice || sellPrice),
    categoryName: hit.categoryName || 'Playstation4 Software',
    priceLastChanged: hit.priceLastChanged,
    storesCount: Array.isArray(hit.stores) ? hit.stores.length : 0,
    productUrl: `https://uk.webuy.com/product-detail?id=${hit.boxId}`,
    sellUrl: `https://uk.webuy.com/sell/product-detail?id=${hit.boxId}`,
  };
}

// Rate-limiting and polite request queue configuration
let lastRequestTimestamp = 0;
const MIN_REQUEST_INTERVAL_MS = 650; // minimum ms between consecutive Algolia requests
let rateLimitedUntilTimestamp = 0; // cooldown window if 429 was encountered

interface AlgoliaQueryResult {
  hits: CexRawHit[];
  nbHits: number;
  nbPages: number;
  page: number;
}

// Low-level HTTPS request to CeX search proxy with realistic browser headers
function executeAlgoliaRequest(paramsString: string, indexName: string): Promise<AlgoliaQueryResult> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      requests: [
        {
          indexName,
          params: paramsString,
        },
      ],
    });

    const options: https.RequestOptions = {
      hostname: CEX_ALGOLIA_HOST,
      port: 443,
      path: '/1/indexes/*/queries',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Algolia-Application-Id': CEX_APP_ID,
        'X-Algolia-API-Key': CEX_API_KEY,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Origin: 'https://uk.webuy.com',
        Referer: 'https://uk.webuy.com/',
        Accept: 'application/json',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          if (res.statusCode === 429 || String(data).includes('1015')) {
            const err = new Error(`CeX rate limit (HTTP 429)`);
            (err as any).statusCode = 429;
            (err as any).isRateLimit = true;
            return reject(err);
          }
          if (res.statusCode && res.statusCode >= 400) {
            const err = new Error(`CeX Algolia returned status ${res.statusCode}`);
            (err as any).statusCode = res.statusCode;
            return reject(err);
          }
          const json = JSON.parse(data);
          const result = json.results?.[0];
          if (!result) {
            return reject(new Error('Invalid CeX API response structure'));
          }
          resolve({
            hits: result.hits || [],
            nbHits: result.nbHits || 0,
            nbPages: result.nbPages || 0,
            page: result.page || 0,
          });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Algolia request timeout'));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Queue for serializing and pacing Algolia requests with exponential backoff & jitter
let queryQueue: Promise<void> = Promise.resolve();

function queryAlgolia(
  paramsString: string,
  indexName = 'prod_cex_uk',
  maxRetries = 3
): Promise<AlgoliaQueryResult> {
  return new Promise((resolve, reject) => {
    queryQueue = queryQueue.then(async () => {
      let attempts = 0;
      while (attempts <= maxRetries) {
        // If under cooldown from previous 429, wait for it to expire
        const now = Date.now();
        if (rateLimitedUntilTimestamp > now) {
          const waitTime = rateLimitedUntilTimestamp - now;
          await new Promise((r) => setTimeout(r, waitTime));
        }

        // Enforce spacing between consecutive calls
        const elapsed = Date.now() - lastRequestTimestamp;
        if (elapsed < MIN_REQUEST_INTERVAL_MS) {
          await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
        }

        try {
          lastRequestTimestamp = Date.now();
          const result = await executeAlgoliaRequest(paramsString, indexName);
          // Auto-clear rate limit error on success
          if (crawlerState.error?.includes('rate limit')) {
            crawlerState.error = null;
          }
          resolve(result);
          return;
        } catch (err: any) {
          attempts++;
          const isRateLimit =
            err?.statusCode === 429 ||
            err?.isRateLimit ||
            String(err?.message || '').includes('429') ||
            String(err?.message || '').includes('1015');

          if (isRateLimit) {
            const backoffMs = Math.min(12000, 2500 * Math.pow(2, attempts - 1) + Math.floor(Math.random() * 800));
            rateLimitedUntilTimestamp = Date.now() + backoffMs;
            console.warn(`[CeX Rate Limit] Pausing queries for ${backoffMs}ms (attempt ${attempts}/${maxRetries})...`);

            if (attempts <= maxRetries) {
              await new Promise((r) => setTimeout(r, backoffMs));
              continue;
            } else {
              const friendlyErr = new Error('CeX live search rate limit reached. Using verified local catalogue.');
              (friendlyErr as any).isRateLimit = true;
              reject(friendlyErr);
              return;
            }
          }

          if (attempts > maxRetries) {
            reject(err);
            return;
          }
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }).catch(reject);
  });
}

// Execute a single staged page query (respectfully throttled to 1 page per 60s)
async function executeSingleStage(stage: StageDefinition): Promise<number> {
  const paramStr = `facetFilters=[["categoryId:${PS4_CATEGORY_ID}"]]&numericFilters=${encodeURIComponent(
    stage.bucketFilter
  )}&hitsPerPage=100&page=${stage.page}`;

  crawlerState.currentBucket = `${stage.bucketLabel} (p.${stage.page + 1})`;
  crawlerState.stageStatusText = `Refreshing ${stage.bucketLabel} page ${stage.page + 1} (${stage.stageIndex + 1}/${STAGES.length})...`;

  try {
    const res = await queryAlgolia(paramStr);
    for (const hit of res.hits) {
      const game = formatGame(hit);
      gamesCache.set(game.id, game);
    }

    crawlerState.itemsCrawled = gamesCache.size;
    crawlerState.lastCrawledAt = new Date().toISOString();
    persistCatalogueToDisk();

    console.log(
      `[CeX 24h Staged Refresh] Stage ${stage.stageIndex + 1}/${STAGES.length} complete: +${res.hits.length} items (${gamesCache.size} total in catalogue)`
    );
    return res.hits.length;
  } catch (err: any) {
    if (err?.isRateLimit || String(err?.message || '').includes('rate limit')) {
      console.warn(`[CeX Staged Refresh] Rate limit detected during stage ${stage.stageIndex + 1}. Backing off for 3 minutes...`);
      crawlerState.error = `CeX rate limit encountered. Auto-pausing staged refresh for 3 minutes. All ${gamesCache.size} titles remain active.`;
      // Push next run back 3 minutes
      crawlerState.nextStageRunAt = Date.now() + 180000;
    } else {
      console.warn(`[CeX Staged Refresh] Error on stage ${stage.stageIndex + 1}:`, err?.message);
    }
    return 0;
  }
}

// 24-Hour Staged Refresh Tick Loop (runs every 5 seconds)
let isExecutingStage = false;
async function tickStagedRefresh() {
  if (!crawlerState.stagedRefreshEnabled || isExecutingStage || crawlerState.isCrawling) {
    return;
  }

  const now = Date.now();
  if (rateLimitedUntilTimestamp > now) {
    return;
  }

  if (crawlerState.nextStageRunAt && now >= crawlerState.nextStageRunAt) {
    isExecutingStage = true;
    try {
      const currentStageDef = STAGES[crawlerState.currentStage];
      if (currentStageDef) {
        await executeSingleStage(currentStageDef);
      }

      const nextStageIndex = crawlerState.currentStage + 1;
      if (nextStageIndex >= STAGES.length) {
        // Full 24-hour cycle completed!
        crawlerState.currentStage = 0;
        crawlerState.lastCycleCompletedAt = new Date().toISOString();
        crawlerState.nextCycleRunAt = Date.now() + TWENTY_FOUR_HOURS_MS;
        crawlerState.nextStageRunAt = crawlerState.nextCycleRunAt;
        crawlerState.stageStatusText = '24-hour cycle completed. All 2,700+ PS4 titles refreshed. Next cycle in 24 hours.';
        console.log('[CeX 24h Staged Refresh] Full 24-hour cycle completed! Next cycle in 24 hours.');
      } else {
        crawlerState.currentStage = nextStageIndex;
        crawlerState.nextStageRunAt = Date.now() + STAGE_INTERVAL_MS;
        const nextDef = STAGES[nextStageIndex];
        crawlerState.stageStatusText = `Stage ${nextStageIndex + 1}/${STAGES.length} scheduled in 60s (${nextDef.bucketLabel} p.${nextDef.page + 1})`;
      }
    } catch (tickErr) {
      console.error('[CeX Staged Refresh] Tick error:', tickErr);
    } finally {
      isExecutingStage = false;
    }
  }
}

setInterval(tickStagedRefresh, 5000);

// Resilient crawler implementation across price brackets (for manual full crawl)
async function runFullCrawl() {
  if (crawlerState.isCrawling) {
    return;
  }

  crawlerState.isCrawling = true;
  crawlerState.error = null;

  try {
    crawlerState.totalFound = 2708;

    for (const stage of STAGES) {
      if (!crawlerState.isCrawling) break;
      await executeSingleStage(stage);
      // Wait 1.5 seconds between pages during manual crawl
      await new Promise((r) => setTimeout(r, 1500));
      if (crawlerState.error) {
        break;
      }
    }

    crawlerState.lastCrawledAt = new Date().toISOString();
    crawlerState.lastCycleCompletedAt = new Date().toISOString();
  } catch (err: any) {
    console.warn('Crawler paused:', err?.message || err);
    if (!crawlerState.error) {
      crawlerState.error = 'Crawl paused to respect CeX rate limits. Existing catalogue remains active.';
    }
  } finally {
    crawlerState.isCrawling = false;
    crawlerState.currentBucket = '';
  }
}

// Initial warm-up: Load persistent live catalogue or fall back to 1,000 verified dataset
async function warmUpCache() {
  try {
    if (fs.existsSync(LIVE_CATALOGUE_PATH)) {
      try {
        const raw = fs.readFileSync(LIVE_CATALOGUE_PATH, 'utf8');
        const liveData: CexGame[] = JSON.parse(raw);
        if (Array.isArray(liveData) && liveData.length > 0) {
          for (const item of liveData) {
            gamesCache.set(item.id, item);
          }
          crawlerState.totalFound = 2708;
          crawlerState.itemsCrawled = gamesCache.size;
          crawlerState.lastCrawledAt = new Date().toISOString();
          crawlerState.hasSeedDataset = true;
          console.log(`[CeX Server] Restored ${gamesCache.size} PS4 titles from persistent live catalogue file!`);
          return;
        }
      } catch (readErr) {
        console.warn('[CeX Server] Failed to read live catalogue, falling back to seed:', readErr);
      }
    }

    const datasetPath = path.join(process.cwd(), 'src', 'data', 'cex_ps4_1000.json');
    if (fs.existsSync(datasetPath)) {
      const raw = fs.readFileSync(datasetPath, 'utf8');
      const dataset: CexGame[] = JSON.parse(raw);
      for (const item of dataset) {
        gamesCache.set(item.id, item);
      }
      crawlerState.totalFound = 2708;
      crawlerState.itemsCrawled = gamesCache.size;
      crawlerState.lastCrawledAt = new Date().toISOString();
      crawlerState.hasSeedDataset = true;
      persistCatalogueToDisk();
      console.log(`[CeX Server] Loaded ${gamesCache.size} PS4 titles from attached verified dataset!`);
    } else {
      for (let page = 0; page < 2; page++) {
        const paramStr = `facetFilters=[["categoryId:${PS4_CATEGORY_ID}"]]&hitsPerPage=100&page=${page}`;
        const res = await queryAlgolia(paramStr);
        for (let i = 0; i < res.hits.length; i++) {
          const game = formatGame(res.hits[i], page * 100 + i + 1);
          gamesCache.set(game.id, game);
        }
        crawlerState.totalFound = res.nbHits;
        crawlerState.itemsCrawled = gamesCache.size;
      }
      crawlerState.lastCrawledAt = new Date().toISOString();
      persistCatalogueToDisk();
    }
  } catch (err) {
    console.error('Warm-up error:', err);
  }
}

// Trigger initial warm up
warmUpCache();

// ==========================================
// API ROUTES
// ==========================================

// Crawler & 24h Staged status endpoint
app.get('/api/cex/status', (req, res) => {
  const now = Date.now();
  let nextStageInSeconds: number | null = null;
  if (crawlerState.stagedRefreshEnabled && crawlerState.nextStageRunAt) {
    nextStageInSeconds = Math.max(0, Math.round((crawlerState.nextStageRunAt - now) / 1000));
  }

  let nextCycleInHours: number | null = null;
  if (crawlerState.nextCycleRunAt && crawlerState.nextCycleRunAt > now) {
    nextCycleInHours = Math.round(((crawlerState.nextCycleRunAt - now) / (1000 * 60 * 60)) * 10) / 10;
  }

  res.json({
    status: 'ok',
    isCrawling: crawlerState.isCrawling,
    totalFound: crawlerState.totalFound,
    itemsCrawled: gamesCache.size,
    currentBucket: crawlerState.currentBucket,
    lastCrawledAt: crawlerState.lastCrawledAt,
    error: crawlerState.error,
    hasSeedDataset: crawlerState.hasSeedDataset,
    stagedRefreshEnabled: crawlerState.stagedRefreshEnabled,
    currentStage: Math.min(crawlerState.currentStage + 1, STAGES.length),
    totalStages: STAGES.length,
    stageStatusText: crawlerState.stageStatusText,
    nextStageInSeconds,
    lastCycleCompletedAt: crawlerState.lastCycleCompletedAt,
    nextCycleInHours,
  });
});

// Toggle 24-hour staged refresh mode
app.post('/api/cex/staged-refresh/toggle', (req, res) => {
  const newState = typeof req.body.enabled === 'boolean' ? req.body.enabled : !crawlerState.stagedRefreshEnabled;
  crawlerState.stagedRefreshEnabled = newState;

  if (newState) {
    crawlerState.nextStageRunAt = Date.now() + 10000;
    crawlerState.stageStatusText = '24h Staged Refresh activated. Next stage runs in 10s.';
  } else {
    crawlerState.nextStageRunAt = null;
    crawlerState.stageStatusText = '24h Staged Refresh paused by user.';
  }

  res.json({
    status: 'ok',
    stagedRefreshEnabled: crawlerState.stagedRefreshEnabled,
    stageStatusText: crawlerState.stageStatusText,
  });
});

// Manually trigger the next stage now
app.post('/api/cex/staged-refresh/run-now', async (req, res) => {
  if (isExecutingStage || crawlerState.isCrawling) {
    return res.status(409).json({ error: 'A stage or crawl is currently executing' });
  }

  crawlerState.nextStageRunAt = Date.now();
  res.json({ status: 'ok', message: 'Triggered next stage execution immediately' });
});

// Reset and start a fresh 24h cycle
app.post('/api/cex/staged-refresh/reset-cycle', (req, res) => {
  crawlerState.currentStage = 0;
  crawlerState.nextStageRunAt = Date.now() + 2000;
  crawlerState.stagedRefreshEnabled = true;
  crawlerState.stageStatusText = `Restarted 24-hour cycle. Stage 1/${STAGES.length} running in 2s...`;
  res.json({ status: 'ok', message: 'Cycle reset to stage 1' });
});

// Bundle Price Sync: Updates price and stock info for all games in the active bundle
app.post('/api/cex/sync-bundle', async (req, res) => {
  try {
    const rawItems: Array<{
      gameId?: string;
      id?: string;
      quantity?: number;
      previousPrices?: {
        buyPrice?: number;
        voucherPrice?: number;
        cashPrice?: number;
      };
    }> = Array.isArray(req.body.items) ? req.body.items : [];

    const forceLive = req.body.forceLive === true;
    const nowIso = new Date().toISOString();

    const updatedItems: any[] = [];
    const priceChanges: any[] = [];

    for (const item of rawItems) {
      const id = String(item.gameId || item.id || '').trim();
      if (!id) continue;

      let game = gamesCache.get(id);

      // If forceLive requested and catalogue doesn't have it or user requested live check
      if (forceLive && Date.now() > rateLimitedUntilTimestamp) {
        try {
          const params = `facetFilters=[["categoryId:${PS4_CATEGORY_ID}"]]&query=${encodeURIComponent(id)}&hitsPerPage=1`;
          const alRes = await queryAlgolia(params, 'prod_cex_uk', 1);
          if (alRes.hits && alRes.hits.length > 0) {
            game = formatGame(alRes.hits[0]);
            gamesCache.set(game.id, game);
          }
        } catch {
          // Fall back gracefully to cache
        }
      }

      if (game) {
        const prevBuy = item.previousPrices?.buyPrice ?? game.buyPrice;
        const prevVoucher = item.previousPrices?.voucherPrice ?? game.voucherPrice;
        const prevCash = item.previousPrices?.cashPrice ?? game.cashPrice;

        const buyDiff = game.buyPrice - prevBuy;
        const voucherDiff = game.voucherPrice - prevVoucher;
        const cashDiff = game.cashPrice - prevCash;
        const priceChanged = buyDiff !== 0 || voucherDiff !== 0 || cashDiff !== 0;

        if (priceChanged) {
          priceChanges.push({
            id: game.id,
            boxName: game.boxName,
            oldBuy: prevBuy,
            newBuy: game.buyPrice,
            buyDiff,
            oldVoucher: prevVoucher,
            newVoucher: game.voucherPrice,
            voucherDiff,
            oldCash: prevCash,
            newCash: game.cashPrice,
            cashDiff,
          });
        }

        updatedItems.push({
          game,
          quantity: item.quantity || 1,
          lastRefreshedAt: nowIso,
          priceChanged,
          previousPrices: {
            buyPrice: prevBuy,
            voucherPrice: prevVoucher,
            cashPrice: prevCash,
          },
        });
      }
    }

    if (forceLive && priceChanges.length > 0) {
      persistCatalogueToDisk();
    }

    res.json({
      status: 'ok',
      totalItems: updatedItems.length,
      hasChanges: priceChanges.length > 0,
      changesCount: priceChanges.length,
      priceChanges,
      updatedItems,
      refreshedAt: nowIso,
    });
  } catch (err: any) {
    console.error('Bundle sync error:', err);
    res.status(500).json({ error: err.message || 'Bundle sync failed' });
  }
});

// Clear crawler error notice
app.post('/api/cex/clear-error', (req, res) => {
  crawlerState.error = null;
  res.json({ status: 'ok' });
});

// Start crawler endpoint
app.post('/api/cex/crawl', async (req, res) => {
  if (crawlerState.isCrawling) {
    return res.json({ message: 'Crawl already in progress', status: 'running' });
  }

  // Start in background
  runFullCrawl();

  res.json({
    message: 'Crawl started in background',
    status: 'started',
    totalEstimated: crawlerState.totalFound || 2708,
  });
});

// Live Search Endpoint (Fast cached query or live Algolia)
app.get('/api/cex/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    const page = Math.max(0, parseInt(String(req.query.page || '0'), 10));
    const hitsPerPage = Math.min(100, Math.max(10, parseInt(String(req.query.limit || '50'), 10)));
    const sortBy = String(req.query.sort || 'relevance'); // relevance, price_asc, price_desc, voucher_desc, cash_desc, ratio_desc, name_asc
    const inStockOnly = req.query.inStock === 'true';
    const minPrice = parseFloat(String(req.query.minPrice || '0')) || 0;
    const maxPrice = parseFloat(String(req.query.maxPrice || '9999')) || 9999;
    const forceLive = req.query.live === 'true';

    // Fast search inside cached dataset when available
    if (gamesCache.size > 0 && !forceLive) {
      let filtered = Array.from(gamesCache.values());

      if (query) {
        const lowerQ = query.toLowerCase();
        filtered = filtered.filter((g) => g.boxName.toLowerCase().includes(lowerQ));
      }

      if (inStockOnly) {
        filtered = filtered.filter((g) => g.inStockOnline || g.inStockStore);
      }

      if (minPrice > 0 || maxPrice < 9999) {
        filtered = filtered.filter((g) => g.buyPrice >= minPrice && g.buyPrice <= maxPrice);
      }

      // If user typed a query that had 0 matches in local cache, fallback to live Algolia
      if (query && filtered.length === 0) {
        // Fall through to live search below
      } else {
        // Sort
        if (sortBy === 'relevance') {
          filtered.sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));
        } else if (sortBy === 'price_asc') {
          filtered.sort((a, b) => a.buyPrice - b.buyPrice);
        } else if (sortBy === 'price_desc') {
          filtered.sort((a, b) => b.buyPrice - a.buyPrice);
        } else if (sortBy === 'voucher_desc') {
          filtered.sort((a, b) => b.voucherPrice - a.voucherPrice);
        } else if (sortBy === 'voucher_asc') {
          filtered.sort((a, b) => a.voucherPrice - b.voucherPrice);
        } else if (sortBy === 'cash_desc') {
          filtered.sort((a, b) => b.cashPrice - a.cashPrice);
        } else if (sortBy === 'ratio_desc') {
          filtered.sort((a, b) => {
            const ratioA = a.buyPrice > 0 ? a.voucherPrice / a.buyPrice : 0;
            const ratioB = b.buyPrice > 0 ? b.voucherPrice / b.buyPrice : 0;
            return ratioB - ratioA;
          });
        } else if (sortBy === 'name_asc') {
          filtered.sort((a, b) => a.boxName.localeCompare(b.boxName));
        } else if (sortBy === 'name_desc') {
          filtered.sort((a, b) => b.boxName.localeCompare(a.boxName));
        }

        const total = filtered.length;
        const paginated = filtered.slice(page * hitsPerPage, (page + 1) * hitsPerPage);

        return res.json({
          hits: paginated,
          total,
          page,
          hitsPerPage,
          nbPages: Math.ceil(total / hitsPerPage),
          source: 'dataset',
        });
      }
    }

    // Direct live Algolia search
    let indexName = 'prod_cex_uk';
    if (sortBy === 'price_asc') indexName = 'prod_cex_uk_price_asc';
    if (sortBy === 'price_desc') indexName = 'prod_cex_uk_price_desc';
    if (sortBy === 'name_asc') indexName = 'prod_cex_uk_box_name_asc';
    if (sortBy === 'name_desc') indexName = 'prod_cex_uk_box_name_desc';
    if (sortBy === 'rating_desc') indexName = 'prod_cex_uk_rating_desc';

    let filters = `categoryId:${PS4_CATEGORY_ID}`;
    if (inStockOnly) {
      filters += ' AND (inStockStore:1 OR inStockOnline:1)';
    }

    let numericFilters = '';
    const numericRules: string[] = [];
    if (minPrice > 0) numericRules.push(`sellPrice>=${minPrice}`);
    if (maxPrice < 9999) numericRules.push(`sellPrice<=${maxPrice}`);
    if (numericRules.length > 0) {
      numericFilters = `&numericFilters=${encodeURIComponent(JSON.stringify(numericRules))}`;
    }

    const params = `query=${encodeURIComponent(query)}&facetFilters=[["categoryId:${PS4_CATEGORY_ID}"]]${numericFilters}&hitsPerPage=${hitsPerPage}&page=${page}`;

    try {
      const alRes = await queryAlgolia(params, indexName);

      const formattedHits = alRes.hits.map((hit, idx) => formatGame(hit, page * hitsPerPage + idx + 1));

      // Also update cache with these hits
      for (const item of formattedHits) {
        gamesCache.set(item.id, item);
      }

      return res.json({
        hits: formattedHits,
        total: alRes.nbHits,
        page: alRes.page,
        hitsPerPage,
        nbPages: alRes.nbPages,
        source: 'live',
      });
    } catch (liveErr: any) {
      console.warn('Live Algolia search rate-limited or unavailable; using local PS4 catalogue fallback:', liveErr?.message);
      // Fallback to local cached dataset
      let fallbackList = Array.from(gamesCache.values());
      if (query) {
        const lowerQ = query.toLowerCase();
        fallbackList = fallbackList.filter((g) => g.boxName.toLowerCase().includes(lowerQ));
      }
      if (inStockOnly) {
        fallbackList = fallbackList.filter((g) => g.inStockOnline || g.inStockStore);
      }
      if (minPrice > 0 || maxPrice < 9999) {
        fallbackList = fallbackList.filter((g) => g.buyPrice >= minPrice && g.buyPrice <= maxPrice);
      }

      const total = fallbackList.length;
      const paginated = fallbackList.slice(page * hitsPerPage, (page + 1) * hitsPerPage);

      return res.json({
        hits: paginated,
        total,
        page,
        hitsPerPage,
        nbPages: Math.ceil(total / hitsPerPage) || 1,
        source: 'dataset_fallback',
        notice: 'Live search currently rate limited by CeX. Showing results from local PS4 catalogue.',
      });
    }
  } catch (err: any) {
    console.error('Search route error:', err);
    res.status(500).json({ error: err.message || 'Search failed' });
  }
});

// Helper for cleaning query and finding candidates
async function resolveSingleGameQuery(rawInput: string): Promise<{
  inputQuery: string;
  cleanedQuery: string;
  status: 'matched' | 'multiple_matches' | 'not_found';
  selectedMatch: CexGame | null;
  candidates: CexGame[];
  matchScore: number;
}> {
  const inputQuery = rawInput.trim();
  if (!inputQuery) {
    return {
      inputQuery,
      cleanedQuery: '',
      status: 'not_found',
      selectedMatch: null,
      candidates: [],
      matchScore: 0,
    };
  }

  // 1. Check if user pasted a CeX product URL
  let parsedId = '';
  try {
    if (inputQuery.includes('id=')) {
      const match = inputQuery.match(/[?&]id=([a-zA-Z0-9]+)/);
      if (match && match[1]) parsedId = match[1];
    }
  } catch {
    // ignore
  }

  // Check if pure ID/barcode
  if (!parsedId && /^[0-9]{8,14}$/.test(inputQuery)) {
    parsedId = inputQuery;
  }

  if (parsedId && gamesCache.has(parsedId)) {
    const game = gamesCache.get(parsedId)!;
    return {
      inputQuery,
      cleanedQuery: parsedId,
      status: 'matched',
      selectedMatch: game,
      candidates: [game],
      matchScore: 100,
    };
  }

  // 2. Clean query: remove bullet points, numbering (1., 2), - ), etc.
  let cleaned = inputQuery.replace(/^\s*(?:\d+[\.\)]|[-*•#>]|\([0-9]+\))\s*/, '').trim();

  // Remove common extraneous words like '(PS4)', 'PlayStation 4', 'PS4 Game' if more words exist
  const strippedPlatform = cleaned
    .replace(/\b(sony\s+playstation\s*4|playstation\s*4|ps4\s+software|ps4\s+game|ps4)\b/gi, '')
    .trim();
  if (strippedPlatform.length >= 3) {
    cleaned = strippedPlatform;
  }

  // Normalized version for matching
  const normQ = cleaned.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const qTokens = normQ.split(' ').filter((t) => t.length > 1);

  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'of', 'and', 'in', 'on', 'for', 'to', 'no', 'with', 'edition', 'deluxe', 'game', 'ps4', 'playstation'
  ]);

  // 3. Search local games cache
  const scoredCandidates: { game: CexGame; score: number }[] = [];
  const significantQTokens = qTokens.filter((t) => !STOP_WORDS.has(t) && t.length > 1);

  for (const game of gamesCache.values()) {
    if (parsedId && game.id === parsedId) {
      scoredCandidates.push({ game, score: 100 });
      break;
    }

    const normTitle = game.boxName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // Exact title match
    if (normTitle === normQ) {
      scoredCandidates.push({ game, score: 98 });
      continue;
    }

    // Direct substring match (if query is at least 3 chars)
    if (normQ.length >= 3 && normTitle.includes(normQ)) {
      const ratio = normQ.length / normTitle.length;
      scoredCandidates.push({ game, score: 85 + ratio * 10 });
      continue;
    }

    if (normTitle.length >= 4 && normQ.includes(normTitle)) {
      scoredCandidates.push({ game, score: 80 });
      continue;
    }

    // Significant token overlap
    if (significantQTokens.length > 0) {
      const titleWords = normTitle.split(' ').filter((w) => !STOP_WORDS.has(w) && w.length > 1);
      let matchedTokens = 0;

      for (const qt of significantQTokens) {
        if (
          titleWords.some(
            (tw) => tw === qt || (tw.length >= 4 && qt.length >= 4 && (tw.startsWith(qt) || qt.startsWith(tw)))
          )
        ) {
          matchedTokens++;
        }
      }

      if (matchedTokens > 0) {
        const tokenRatio = matchedTokens / significantQTokens.length;
        if (tokenRatio >= 0.5) {
          let s = tokenRatio * 65;
          if (tokenRatio === 1) s += 15;
          const diff = Math.abs(titleWords.length - significantQTokens.length);
          s -= Math.min(10, diff * 1.5);
          scoredCandidates.push({ game, score: Math.max(10, s) });
        }
      }
    }
  }

  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.game.position ?? 9999) - (b.game.position ?? 9999);
  });

  let topCandidates = scoredCandidates.slice(0, 5).map((c) => c.game);
  let bestScore = scoredCandidates[0]?.score || 0;

  // 4. If no high score candidates in cache, query live CeX Algolia (if not currently in rate limit cooldown)
  if ((topCandidates.length === 0 || bestScore < 50) && Date.now() > rateLimitedUntilTimestamp) {
    try {
      const params = `query=${encodeURIComponent(cleaned)}&facetFilters=[["categoryId:${PS4_CATEGORY_ID}"]]&hitsPerPage=5`;
      const alRes = await queryAlgolia(params, 'prod_cex_uk', 1);
      if (alRes.hits && alRes.hits.length > 0) {
        const formatted = alRes.hits.map((hit, idx) => formatGame(hit, idx + 1));
        // Cache them
        for (const f of formatted) {
          gamesCache.set(f.id, f);
        }
        topCandidates = formatted;
        bestScore = 75; // Algolia direct match
      } else {
        // Algolia found nothing and local cache score was below confidence threshold
        if (bestScore < 50) {
          topCandidates = [];
          bestScore = 0;
        }
      }
    } catch {
      // Gracefully ignore live lookup issues and use local candidate
      if (bestScore < 50) {
        topCandidates = [];
        bestScore = 0;
      }
    }
  }

  if (topCandidates.length === 0) {
    return {
      inputQuery,
      cleanedQuery: cleaned,
      status: 'not_found',
      selectedMatch: null,
      candidates: [],
      matchScore: 0,
    };
  }

  // If there's an exact or clear top match (bestScore >= 80 or single candidate)
  const isMultiple = topCandidates.length > 1 && bestScore < 95;

  return {
    inputQuery,
    cleanedQuery: cleaned,
    status: isMultiple ? 'multiple_matches' : 'matched',
    selectedMatch: topCandidates[0],
    candidates: topCandidates,
    matchScore: Math.round(bestScore),
  };
}

// Bulk Search Endpoint: POST /api/cex/bulk-search
app.post('/api/cex/bulk-search', async (req, res) => {
  try {
    const rawList: string[] = Array.isArray(req.body.items)
      ? req.body.items
      : typeof req.body.text === 'string'
      ? req.body.text.split(/\r?\n/)
      : [];

    // Filter empty lines and cap at 100 to avoid runaway loads
    const queries = rawList
      .map((s) => String(s || '').trim())
      .filter((s) => s.length > 0)
      .slice(0, 100);

    if (queries.length === 0) {
      return res.json({
        totalQueries: 0,
        matchedCount: 0,
        notFoundCount: 0,
        results: [],
      });
    }

    // Process items in chunks of 5 concurrently to be fast and respectful
    const results: any[] = [];
    const chunkSize = 5;
    for (let i = 0; i < queries.length; i += chunkSize) {
      const chunk = queries.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map((q) => resolveSingleGameQuery(q)));
      results.push(...chunkResults);
    }

    const matchedCount = results.filter((r) => r.selectedMatch !== null).length;
    const notFoundCount = results.filter((r) => r.status === 'not_found').length;

    res.json({
      totalQueries: queries.length,
      matchedCount,
      notFoundCount,
      results,
    });
  } catch (err: any) {
    console.error('Bulk search error:', err);
    res.status(500).json({ error: err.message || 'Bulk search failed' });
  }
});

// Download attached dataset CSV directly
app.get('/api/cex/dataset/csv', (req, res) => {
  const csvPath = path.join(process.cwd(), 'src', 'data', 'cex_ps4_dataset.csv');
  if (fs.existsSync(csvPath)) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="cex_ps4_dataset_1000.csv"');
    return res.sendFile(csvPath);
  }
  res.status(404).json({ error: 'Dataset file not found' });
});

// Return all cached games
app.get('/api/cex/all', (req, res) => {
  const games = Array.from(gamesCache.values());
  res.json({
    total: games.length,
    lastCrawledAt: crawlerState.lastCrawledAt,
    isCrawling: crawlerState.isCrawling,
    games,
  });
});

// CSV Export of crawled / filtered titles
app.get('/api/cex/export', (req, res) => {
  const games = Array.from(gamesCache.values());

  const headers = [
    'Box ID',
    'Title',
    'Buy Price (WeSell)',
    'Trade-in Voucher (WeBuy)',
    'Trade-in Cash (WeBuy)',
    'Voucher to Buy Ratio (%)',
    'Rating',
    'In Stock Online',
    'In Stock Store',
    'PEGI',
    'CeX URL',
  ];

  const rows = games.map((g) => {
    const ratio = g.buyPrice > 0 ? ((g.voucherPrice / g.buyPrice) * 100).toFixed(1) : '0';
    const cexUrl = `https://uk.webuy.com/product-detail?id=${g.id}`;
    return [
      `"${g.id}"`,
      `"${g.boxName.replace(/"/g, '""')}"`,
      g.buyPrice.toFixed(2),
      g.voucherPrice.toFixed(2),
      g.cashPrice.toFixed(2),
      `${ratio}%`,
      g.rating,
      g.inStockOnline ? 'Yes' : 'No',
      g.inStockStore ? 'Yes' : 'No',
      `"${g.pegi}"`,
      `"${cexUrl}"`,
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="cex-ps4-games.csv"');
  res.send(csv);
});

// Start server with Vite middleware integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CeX Crawler Server running on http://localhost:${PORT}`);
  });
}

startServer();
