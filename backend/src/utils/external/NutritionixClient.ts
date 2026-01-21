const axios = require("axios");

// Nutritionix API client
const nutritionixSearch = async (query: string) => {
  const appId = process.env.NUTRITIONIX_APP_ID;
  const appKey = process.env.NUTRITIONIX_APP_KEY;

  if (!appId || !appKey) {
    return null; // no keys available at,, so skip Nutritionix (fallback will handle)
  }

  const url = "https://trackapi.nutritionix.com/v2/search/instant";

  const resp = await axios.get(url, {
    headers: {
      "x-app-id": appId,
      "x-app-key": appKey,
    },
    params: { query },
    timeout: 8000,
  });

  return resp.data;
};

module.exports = { nutritionixSearch };

export {};
