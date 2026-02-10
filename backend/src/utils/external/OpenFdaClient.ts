const axios = require("axios");
// OpenFDA Drug Label API client (server side only)
const OPEN_FDA_BASE = "https://api.fda.gov/drug/label.json";

// helper so quotes/slashes dont break OpenFDA query syntax
const sanitizeQueryTerm = (input: string) => {
  return String(input || "")
    .trim()
    .replace(/["\\]/g, ""); // remove " and \ to avoid invalid query syntax
};

// Search by generic/brand name (used for /medications/search)
const openFdaSearch = async (q: string) => {
  const term = sanitizeQueryTerm(q);

  if (!term || term.length < 2) {
    return null;
  }

  const search = `openfda.generic_name:"${term}" OR openfda.brand_name:"${term}"`;

  try {
    const resp = await axios.get(OPEN_FDA_BASE, {
      params: { search, limit: 10 },
      timeout: 12000,
    });

    return resp.data;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      return null;
    }
    // return null so controller can fallback to DailyMed
    console.error("OpenFDA search error:", err?.message);
    return null;
  }
};

// Fetch details by set_id (used for /medications/log)
// OpenFDA doesnt do "GET by id" well for labels, so query using set_id
const openFdaGetBySetId = async (setId: string) => {
  const safeSetId = sanitizeQueryTerm(setId);

  if (!safeSetId) {
    return null;
  }

  // try both common id fields (OpenFDA varies by record)
  const search = `set_id:"${safeSetId}" OR openfda.spl_set_id:"${safeSetId}" OR id:"${safeSetId}"`;

  try {
    const resp = await axios.get(OPEN_FDA_BASE, {
      params: { search, limit: 1 },
      timeout: 12000,
    });

    return resp.data;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      return null;
    }

    console.error("OpenFDA get-by-set-id error:", err?.message);
    throw err;
  }
};

module.exports = { openFdaSearch, openFdaGetBySetId };

export {};