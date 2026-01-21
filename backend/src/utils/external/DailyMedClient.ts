const axios = require("axios");
// DailyMed search + fetch (server side only)
// DailyMed is fallback when OpenFDA fields are messy or incomplete
const DAILYMED_BASE = "https://dailymed.nlm.nih.gov/dailymed/services/v2";

//keep headers consistent
const buildHeaders = () => ({
  "User-Agent": "ChronicPal/1.0 (student project)",
  Accept: "application/json",
});

const dailyMedSearch = async (query: string, pageSize: number = 10, page: number = 1) => {
  const q = String(query || "").trim();

  // avoid pointless external calls (helps rate limiting)
  if (!q) {
    return { data: [], results: [] };
  }

  const url = `${DAILYMED_BASE}/spls.json`;

  const resp = await axios.get(url, {
    params: {
      drug_name: q,
      page: Math.max(parseInt(String(page), 10) || 1, 1),
      pagesize: Math.min(Math.max(parseInt(String(pageSize), 10) || 10, 1), 25),
    },
    timeout: 12000,
    headers: buildHeaders(),
    validateStatus: (status: number) => status >= 200 && status < 300,
  });

  return resp.data;
};

// Fetch a single SPL record by setid
const dailyMedGetDetails = async (setId: string) => {
  const safeSetId = String(setId || "").trim();
  const url = `${DAILYMED_BASE}/spls/${encodeURIComponent(safeSetId)}.json`;

  const resp = await axios.get(url, {
    timeout: 12000,
    headers: buildHeaders(),
    validateStatus: (status: number) => status >= 200 && status < 300,
  });

  return resp.data;
};

module.exports = { dailyMedSearch, dailyMedGetDetails };

export {};