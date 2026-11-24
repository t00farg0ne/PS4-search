const https = require('https');

const postData = JSON.stringify({
  requests: [
    {
      indexName: 'prod_cex_uk',
      params: 'facetFilters=[["categoryId:1003"]]&hitsPerPage=10&page=0',
    },
  ],
});

const req = https.request({
  hostname: 'search.webuy.io',
  port: 443,
  path: '/1/indexes/*/queries',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Algolia-Application-Id': 'LNNFEEWZVA',
    'X-Algolia-API-Key': 'bf79f2b6699e60a18ae330a1248b452c',
    'User-Agent': 'Mozilla/5.0',
  },
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const hits = json.results[0].hits;
    console.log("Top 5 from Algolia:");
    hits.slice(0, 5).forEach((h, i) => {
      console.log(`${i+1}. ${h.boxName} (${h.boxId}) - Sell: £${h.sellPrice}, Exch: £${h.exchangePriceCalculated || h.exchangePrice}, Cash: £${h.cashPriceCalculated || h.cashPrice}`);
    });
  });
});
req.write(postData);
req.end();
