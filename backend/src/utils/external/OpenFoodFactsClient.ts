const axios = require("axios");

// OpenFoodFacts fallback search
const openFoodFactsSearch = async (query: string) => {
  const url = "https://world.openfoodfacts.net/api/v2/search";

  const resp = await axios.get(url, {
    params: {
      search_terms: query,
      page_size: 10,
    },
    timeout: 8000,
  });

  return resp.data;
};

// Fetch product by barcode/code
const openFoodFactsGetProduct = async (code: string) => {
  const safeCode = String(code).trim();
  const url = `https://world.openfoodfacts.net/api/v2/product/${encodeURIComponent(
    safeCode
  )}`;

  const resp = await axios.get(url, { timeout: 8000 });
  return resp.data;
};

module.exports = { openFoodFactsSearch, openFoodFactsGetProduct };

export {};