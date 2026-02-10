import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getFrequentItems,
  getMyFoodLogs,
  getMyMedicationLogs,
  getMySymptomLogs,
  logFood,
  logFoodManual,
  logMedication,
  logMedicationManual,
  logSymptom,
  deleteFoodLog,
  deleteMedicationLog,
  deleteSymptomLog,
  getFavourites,
  addFavourite,
  deleteFavourite,
  searchFood,
  searchMedication,
} from "../services/Api";

// Multi tab layout design keeps symptom/food/med logging in one place 
// instead of loads of files/pages and is cleaner ui
type TabKey = "symptoms" | "food" | "medication";

type SearchItem = {
  id: string;
  name: string;
  source?: string;
  caloriesKcal?: number | null;
  brand?: string | null;
};

type FoodSource = "NUTRITIONIX" | "OPENFOODFACTS";
type MedicationSource = "OPENFDA" | "DAILYMED";

type FavouriteItem = {
  id: number;
  type: "FOOD" | "MEDICATION";
  name: string;
  externalId?: string | null;
  source?: string | null;
};

type RiskTags = {
  containsDairy?: boolean | null;
  containsGluten?: boolean | null;
  highFibre?: boolean | null;
  spicy?: boolean | null;
  highFat?: boolean | null;
  caffeine?: boolean | null;
  alcohol?: boolean | null;
  highSugar?: boolean | null;
  highSodium?: boolean | null;
  highIron?: boolean | null;
};

function DailyLog() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  const [params, setParams] = useSearchParams();
  const tabParam = (params.get("tab") || "symptoms") as TabKey;

  const [tab, setTab] = useState<TabKey>(
    tabParam === "food" || tabParam === "medication" || tabParam === "symptoms"
      ? tabParam
      : "symptoms"
  );

  useEffect(() => {
    // guardrail only backend still enforces rbac
    if (role && role !== "patient") navigate("/");
  }, [role, navigate]);

  useEffect(() => {
    // keep tab in URL so refresh/share preserves current view
    setParams((p) => {
      p.set("tab", tab);
      return p;
    });
  }, [tab, setParams]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Allow backdating within 30 days for missed logs (ui only backend still validates)
  const [logDate, setLogDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const maxLogDate = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);
  const minLogDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  // Frequent items = quick log shortcuts from recent history
  const [freqSymptoms, setFreqSymptoms] = useState<any[]>([]);
  const [freqFood, setFreqFood] = useState<any[]>([]);
  const [freqMeds, setFreqMeds] = useState<any[]>([]);
  const freqFetchRef = useRef(0);
  const [recentSymptoms, setRecentSymptoms] = useState<any[]>([]);
  const [recentFoods, setRecentFoods] = useState<any[]>([]);
  const [recentMeds, setRecentMeds] = useState<any[]>([]);
  const recentFetchRef = useRef(0);
  const [recentFrom, setRecentFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [recentTo, setRecentTo] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  // Get frequent items for quick log
  const refreshFrequent = async () => {
    try {
      const now = Date.now();
      if (now - freqFetchRef.current < 8000) return;
      freqFetchRef.current = now;

      const [s, f, m] = await Promise.allSettled([
        getFrequentItems({ days: 30, type: "symptom" }),
        getFrequentItems({ days: 30, type: "food" }),
        getFrequentItems({ days: 30, type: "medication" }),
      ]);

      if (s.status === "fulfilled") {
        setFreqSymptoms(normalizeRows(s.value?.items || s.value));
      }
      if (f.status === "fulfilled") {
        setFreqFood(normalizeRows(f.value?.items || f.value));
      }
      if (m.status === "fulfilled") {
        setFreqMeds(normalizeRows(m.value?.items || m.value));
      }
    } catch {
      // keep silent, page still works without frequent items
    }
  };

  // Recent logs power delete/undo and respect the date filter
  const refreshRecent = useCallback(async (type: "symptom" | "food" | "medication") => {
    try {
      const now = Date.now();
      if (now - recentFetchRef.current < 4000) return;
      recentFetchRef.current = now;

      const from = recentFrom ? `${recentFrom}T00:00:00` : undefined;
      const to = recentTo ? `${recentTo}T23:59:59` : undefined;

      if (type === "symptom") {
        const res = await getMySymptomLogs({ limit: 5, from, to });
        setRecentSymptoms(normalizeRows(res?.items || res));
      }
      if (type === "food") {
        const res = await getMyFoodLogs({ limit: 5, from, to });
        setRecentFoods(normalizeRows(res?.items || res));
      }
      if (type === "medication") {
        const res = await getMyMedicationLogs({ limit: 5, from, to });
        setRecentMeds(normalizeRows(res?.items || res));
      }
    } catch {

    }
  }, [recentFrom, recentTo]);

  const refreshFavourites = async (type: "FOOD" | "MEDICATION") => {
    const now = Date.now();
    const ref = type === "FOOD" ? favFoodFetchRef : favMedFetchRef;
    if (now - ref.current < 8000) return;
    ref.current = now;

    try {
      const res = await getFavourites(type);
      const list = Array.isArray(res?.favourites) ? res.favourites : [];
      if (type === "FOOD") setFavFoods(list);
      if (type === "MEDICATION") setFavMeds(list);
    } catch {
    }
  };

  useEffect(() => {
    refreshFrequent();
  }, []);

  useEffect(() => {
    // refresh recent logs when tab or date filter changes
    if (tab === "symptoms") refreshRecent("symptom");
    if (tab === "food") refreshRecent("food");
    if (tab === "medication") refreshRecent("medication");
  }, [tab, refreshRecent]);

  // ------ SYMPTOMS -----
  const [symptomName, setSymptomName] = useState("Headache");
  const [severity, setSeverity] = useState<number>(5);
  const [symptomNotes, setSymptomNotes] = useState("");

  // ------ FOOD -------
  const [foodQuery, setFoodQuery] = useState("");
  const [foodResults, setFoodResults] = useState<SearchItem[]>([]);
  const [foodManualName, setFoodManualName] = useState("");
  const [foodManualCalories, setFoodManualCalories] = useState<string>("");
  // Optional tags to help insights spot possible food patterns
  const [foodRiskTags, setFoodRiskTags] = useState<RiskTags>({});
  const [favFoods, setFavFoods] = useState<FavouriteItem[]>([]);
  const favFoodFetchRef = useRef(0);

  // ------ MEDICATION ---------
  const [medQuery, setMedQuery] = useState("");
  const [medResults, setMedResults] = useState<SearchItem[]>([]);
  const [medManualName, setMedManualName] = useState("");
  const [medManualDose, setMedManualDose] = useState("");
  const [favMeds, setFavMeds] = useState<FavouriteItem[]>([]);
  const favMedFetchRef = useRef(0);

  const foodSearchRef = useRef<{ lastQuery: string; lastTs: number; reqId: number }>({
    lastQuery: "",
    lastTs: 0,
    reqId: 0,
  });
  const medSearchRef = useRef<{ lastQuery: string; lastTs: number; reqId: number }>({
    lastQuery: "",
    lastTs: 0,
    reqId: 0,
  });

  useEffect(() => {
    const t = setTimeout(async () => {
      if (tab !== "food") return;
      refreshFavourites("FOOD");
      const q = foodQuery.trim();
      if (q.length < 2) {
        setFoodResults([]);
        return;
      }

      const now = Date.now();
      if (
        q === foodSearchRef.current.lastQuery &&
        now - foodSearchRef.current.lastTs < 500
      ) {
        return;
      }

      const reqId = ++foodSearchRef.current.reqId;
      foodSearchRef.current.lastQuery = q;
      foodSearchRef.current.lastTs = now;

      try {
        const res = await searchFood(q);
        if (reqId !== foodSearchRef.current.reqId) return;
        setFoodResults(normalizeSearch(res));
      } catch {
        if (reqId !== foodSearchRef.current.reqId) return;
        setFoodResults([]);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [foodQuery, tab]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (tab !== "medication") return;
      refreshFavourites("MEDICATION");
      const q = medQuery.trim();
      if (q.length < 2) {
        setMedResults([]);
        return;
      }

      const now = Date.now();
      if (
        q === medSearchRef.current.lastQuery &&
        now - medSearchRef.current.lastTs < 500
      ) {
        return;
      }

      const reqId = ++medSearchRef.current.reqId;
      medSearchRef.current.lastQuery = q;
      medSearchRef.current.lastTs = now;

      try {
        const res = await searchMedication(q);
        if (reqId !== medSearchRef.current.reqId) return;
        setMedResults(normalizeSearch(res));
      } catch {
        if (reqId !== medSearchRef.current.reqId) return;
        setMedResults([]);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [medQuery, tab]);

  const handleAuthErrors = (e: any) => {
    // normalize auth failures so ui react consistently
    if (e?.status === 401) {
      setMsg("Session expired. Please login again.");
      navigate("/login");
      return true;
    }
    if (e?.status === 403) {
      setMsg("Access denied.");
      return true;
    }
    return false;
  };

  const onLogSymptom = async () => {
    setBusy(true);
    setMsg(null);

    try {
      await logSymptom({
        symptomName: symptomName.trim(),
        severity: Number(severity),
        notes: symptomNotes.trim() || undefined,
        loggedAt: toIsoFromDate(logDate),
      });

      setMsg("Symptom logged.");
      setSymptomNotes("");
      await refreshFrequent();
      await refreshRecent("symptom");
    } catch (e: any) {
      if (handleAuthErrors(e)) return;
      setMsg(e?.error || "Could not log symptom.");
    } finally {
      setBusy(false);
    }
  };

  const onLogFoodFromSearch = async (it: SearchItem) => {
    setBusy(true);
    setMsg(null);

    try {
      const sourceRaw = it.source ? String(it.source).toUpperCase() : "NUTRITIONIX";
      const source: FoodSource =
        sourceRaw === "NUTRITIONIX" || sourceRaw === "OPENFOODFACTS"
          ? sourceRaw
          : "NUTRITIONIX";

      await logFood({
        externalId: it.id,
        source,
        consumedAt: toIsoFromDate(logDate),
        riskTags: cleanRiskTags(foodRiskTags),
      });

      setMsg("Food logged.");
      await refreshFrequent();
      await refreshRecent("food");
    } catch (e: any) {
      if (handleAuthErrors(e)) return;
      setMsg(e?.error || "Could not log food.");
    } finally {
      setBusy(false);
    }
  };

  const onLogFoodManual = async () => {
    setBusy(true);
    setMsg(null);

    try {
      const calRaw = foodManualCalories.trim();
      const cal = calRaw.length === 0 ? null : Number(calRaw);
      const payload: any = {
        name: foodManualName.trim(),
        consumedAt: toIsoFromDate(logDate),
        riskTags: cleanRiskTags(foodRiskTags),
      };

      if (cal !== null && Number.isFinite(cal)) {
        payload.caloriesKcal = cal;
      }

      await logFoodManual(payload);

      setMsg("Manual food logged.");
      setFoodManualName("");
      setFoodManualCalories("");
      await refreshFrequent();
      await refreshRecent("food");
    } catch (e: any) {
      if (handleAuthErrors(e)) return;
      setMsg(e?.error || "Could not log manual food.");
    } finally {
      setBusy(false);
    }
  };

  const onLogMedFromSearch = async (it: SearchItem) => {
    setBusy(true);
    setMsg(null);

    try {
      const sourceRaw = it.source ? String(it.source).toUpperCase() : "OPENFDA";
      const source: MedicationSource =
        sourceRaw === "OPENFDA" || sourceRaw === "DAILYMED" ? sourceRaw : "OPENFDA";

      await logMedication({
        externalId: it.id,
        source,
        takenAt: toIsoFromDate(logDate),
      });

      setMsg("Medication logged.");
      await refreshFrequent();
      await refreshRecent("medication");
    } catch (e: any) {
      if (handleAuthErrors(e)) return;
      setMsg(e?.error || "Could not log medication.");
    } finally {
      setBusy(false);
    }
  };

  const onLogMedManual = async () => {
    setBusy(true);
    setMsg(null);

    try {
      const payload: any = {
        medicationName: medManualName.trim(),
        takenAt: toIsoFromDate(logDate),
      };

      const dose = medManualDose.trim();
      if (dose.length > 0) payload.dosage = dose;

      await logMedicationManual(payload);

      setMsg("Manual medication logged.");
      setMedManualName("");
      setMedManualDose("");
      await refreshFrequent();
      await refreshRecent("medication");
    } catch (e: any) {
      if (handleAuthErrors(e)) return;
      setMsg(e?.error || "Could not log manual medication.");
    } finally {
      setBusy(false);
    }
  };

  const onAddFavouriteFood = async (it: SearchItem) => {
    try {
      const sourceRaw = it.source ? String(it.source).toUpperCase() : "NUTRITIONIX";
      const source: FoodSource =
        sourceRaw === "NUTRITIONIX" || sourceRaw === "OPENFOODFACTS"
          ? sourceRaw
          : "NUTRITIONIX";

      await addFavourite({
        type: "FOOD",
        name: it.name,
        externalId: it.id,
        source,
      });
      refreshFavourites("FOOD");
      setMsg("Added to favourites.");
    } catch (e: any) {
      if (handleAuthErrors(e)) return;
      setMsg(e?.error || "Could not add favourite.");
    }
  };

  const onAddFavouriteFoodManual = async () => {
    try {
      const name = foodManualName.trim();
      if (name.length < 2) {
        setMsg("Enter a food name first.");
        return;
      }
      await addFavourite({
        type: "FOOD",
        name,
        externalId: null,
        source: "MANUAL",
      });
      refreshFavourites("FOOD");
      setMsg("Added to favourites.");
    } catch (e: any) {
      if (handleAuthErrors(e)) return;
      setMsg(e?.error || "Could not add favourite.");
    }
  };

  const onAddFavouriteMed = async (it: SearchItem) => {
    try {
      const sourceRaw = it.source ? String(it.source).toUpperCase() : "OPENFDA";
      const source: MedicationSource =
        sourceRaw === "OPENFDA" || sourceRaw === "DAILYMED" ? sourceRaw : "OPENFDA";

      await addFavourite({
        type: "MEDICATION",
        name: it.name,
        externalId: it.id,
        source,
      });
      refreshFavourites("MEDICATION");
      setMsg("Added to favourites.");
    } catch (e: any) {
      if (handleAuthErrors(e)) return;
      setMsg(e?.error || "Could not add favourite.");
    }
  };

  const onAddFavouriteMedManual = async () => {
    try {
      const name = medManualName.trim();
      if (name.length < 2) {
        setMsg("Enter a medication name first.");
        return;
      }
      await addFavourite({
        type: "MEDICATION",
        name,
        externalId: null,
        source: "MANUAL",
      });
      refreshFavourites("MEDICATION");
      setMsg("Added to favourites.");
    } catch (e: any) {
      if (handleAuthErrors(e)) return;
      setMsg(e?.error || "Could not add favourite.");
    }
  };

  const onLogFavourite = async (fav: FavouriteItem) => {
    setBusy(true);
    setMsg(null);

    try {
      if (fav.type === "FOOD") {
        const sourceRaw = fav.source ? String(fav.source).toUpperCase() : "";
        const source: FoodSource | null =
          sourceRaw === "NUTRITIONIX" || sourceRaw === "OPENFOODFACTS"
            ? sourceRaw
            : null;

        if (source && fav.externalId) {
          await logFood({
            externalId: String(fav.externalId),
            source,
            consumedAt: toIsoFromDate(logDate),
            riskTags: cleanRiskTags(foodRiskTags),
          });
        } else {
          await logFoodManual({
            name: fav.name,
            consumedAt: toIsoFromDate(logDate),
            riskTags: cleanRiskTags(foodRiskTags),
          });
        }
      }

      if (fav.type === "MEDICATION") {
        const sourceRaw = fav.source ? String(fav.source).toUpperCase() : "";
        const source: MedicationSource | null =
          sourceRaw === "OPENFDA" || sourceRaw === "DAILYMED" ? sourceRaw : null;

        if (source && fav.externalId) {
          await logMedication({
            externalId: String(fav.externalId),
            source,
            takenAt: toIsoFromDate(logDate),
          });
        } else {
          await logMedicationManual({
            medicationName: fav.name,
            takenAt: toIsoFromDate(logDate),
          });
        }
      }

      setMsg("Favourite logged.");
      await refreshFrequent();
      if (fav.type === "FOOD") await refreshRecent("food");
      if (fav.type === "MEDICATION") await refreshRecent("medication");
    } catch (e: any) {
      if (handleAuthErrors(e)) return;
      setMsg(e?.error || "Could not log favourite.");
    } finally {
      setBusy(false);
    }
  };

  const onRemoveFavourite = async (fav: FavouriteItem) => {
    try {
      await deleteFavourite(fav.id);
      if (fav.type === "FOOD") refreshFavourites("FOOD");
      if (fav.type === "MEDICATION") refreshFavourites("MEDICATION");
      setMsg("Removed from favourites.");
    } catch (e: any) {
      if (handleAuthErrors(e)) return;
      setMsg(e?.error || "Could not remove favourite.");
    }
  };

  const onLogFrequent = async (type: "symptom" | "food" | "medication", name: string) => {
    setBusy(true);
    setMsg(null);

    try {
      if (type === "symptom") {
        await logSymptom({
          symptomName: name,
          severity: Number(severity),
          loggedAt: toIsoFromDate(logDate),
        });
      }

      if (type === "food") {
        await logFoodManual({
          name,
          consumedAt: toIsoFromDate(logDate),
        });
      }

      if (type === "medication") {
        await logMedicationManual({
          medicationName: name,
          takenAt: toIsoFromDate(logDate),
        });
      }

      setMsg("Logged from frequent items.");
      await refreshFrequent();
      await refreshRecent(type);
    } catch (e: any) {
      if (handleAuthErrors(e)) return;
      setMsg(e?.error || "Could not log frequent item.");
    } finally {
      setBusy(false);
    }
  };

  const header = useMemo(() => {
    if (tab === "symptoms") return "Log Symptoms";
    if (tab === "food") return "Log Food";
    return "Log Medication";
  }, [tab]);

  const onDeleteRecent = async (type: "symptom" | "food" | "medication", id: number) => {
    // delete from recent list only (safer than deleting frequent shortcuts)
    if (!Number.isFinite(id)) return;
    const ok = window.confirm("Remove this log entry?");
    if (!ok) return;

    setBusy(true);
    setMsg(null);

    try {
      if (type === "symptom") await deleteSymptomLog(id);
      if (type === "food") await deleteFoodLog(id);
      if (type === "medication") await deleteMedicationLog(id);
      setMsg("Log entry removed.");
      await refreshRecent(type);
    } catch (e: any) {
      if (handleAuthErrors(e)) return;
      setMsg(e?.error || "Could not remove log.");
    } finally {
      setBusy(false);
    }
  };

  // checkbox helper
  const renderRiskTagToggle = (key: keyof RiskTags, label: string) => {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(foodRiskTags?.[key])}
          onChange={() =>
            setFoodRiskTags((prev) => ({
              ...(prev || {}),
              [key]: !prev?.[key],
            }))
          }
        />
        <span>{label}</span>
      </label>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Daily Log</h1>
          <p className="text-slate-700 mt-1">
            Record symptoms, food and medication in one place.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            className="px-4 py-2 border rounded bg-white hover:bg-slate-50 text-sm"
            onClick={() => navigate("/patient")}
          >
            Back to Dashboard
          </button>
          <button
            className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
            onClick={() => navigate("/patient/insights")}
          >
            View Insights
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white p-3 rounded-xl shadow mb-6 flex gap-2 flex-wrap">
        <TabButton active={tab === "symptoms"} onClick={() => setTab("symptoms")}>
          Symptoms
        </TabButton>
        <TabButton active={tab === "food"} onClick={() => setTab("food")}>
          Food
        </TabButton>
        <TabButton active={tab === "medication"} onClick={() => setTab("medication")}>
          Medication
        </TabButton>
      </div>

      {/* Status message */}
      {msg ? (
        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <p className="text-sm text-slate-700">{msg}</p>
        </div>
      ) : null}

      {/* Main card */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold">{header}</h2>

        {/* Symptoms */}
        {tab === "symptoms" ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-slate-700">Log date</label>
              <input
                className="mt-2 w-full border rounded px-3 py-2 text-sm"
                type="date"
                value={logDate}
                min={minLogDate}
                max={maxLogDate}
                onChange={(e) => setLogDate(e.target.value)}
              />

              <label className="text-sm font-semibold text-slate-700">Symptom</label>
              <input
                className="mt-2 w-full border rounded px-3 py-2 text-sm"
                value={symptomName}
                onChange={(e) => setSymptomName(e.target.value)}
                placeholder="e.g. Headache"
              />

              <label className="text-sm font-semibold text-slate-700 block mt-4">
                Severity (1–10)
              </label>
              <input
                className="mt-2 w-full"
                type="range"
                min={1}
                max={10}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
              />
              <div className="text-sm text-slate-700 mt-1">Selected: {severity}</div>

              <label className="text-sm font-semibold text-slate-700 block mt-4">
                Notes (optional)
              </label>
              <textarea
                className="mt-2 w-full border rounded px-3 py-2 text-sm"
                rows={3}
                value={symptomNotes}
                onChange={(e) => setSymptomNotes(e.target.value)}
                placeholder="Any context (sleep, stress, triggers)..."
              />

              <button
                className="mt-4 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm disabled:opacity-60"
                disabled={busy || symptomName.trim().length < 2}
                onClick={onLogSymptom}
              >
                Log symptom
              </button>
            </div>

            <div className="space-y-4">
              <RecentPanel
                title="Frequent symptoms"
                rows={freqSymptoms}
                onLog={(name) => onLogFrequent("symptom", name)}
              />
              <RecentLogsPanel
                title="Past symptom logs"
                rows={recentSymptoms}
                onDelete={(id) => onDeleteRecent("symptom", id)}
                from={recentFrom}
                to={recentTo}
                onFromChange={setRecentFrom}
                onToChange={setRecentTo}
              />
            </div>
          </div>
        ) : null}

        {/* Food */}
        {tab === "food" ? (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-slate-700">Log date</label>
              <input
                className="mt-2 w-full border rounded px-3 py-2 text-sm"
                type="date"
                value={logDate}
                min={minLogDate}
                max={maxLogDate}
                onChange={(e) => setLogDate(e.target.value)}
              />

              <label className="text-sm font-semibold text-slate-700">Search food</label>
              <input
                className="mt-2 w-full border rounded px-3 py-2 text-sm"
                value={foodQuery}
                onChange={(e) => setFoodQuery(e.target.value)}
                placeholder="Search Nutritionix / OpenFoodFacts..."
              />

              <div className="mt-3 space-y-2">
                {foodResults.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Type at least 2 characters to search.
                  </p>
                ) : (
                  foodResults.slice(0, 8).map((it) => (
                    <div
                      key={`food-${it.id}`}
                      className="border rounded p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {it.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {it.source ? `Source: ${it.source}` : "Source: n/a"}
                          {typeof it.caloriesKcal === "number" ? ` • ${it.caloriesKcal} kcal` : ""}
                        </p>
                      </div>

                      <button
                        className="px-3 py-1.5 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm disabled:opacity-60"
                        disabled={busy}
                        onClick={() => onLogFoodFromSearch(it)}
                      >
                        Log
                      </button>
                      <button
                        className="px-3 py-1.5 border rounded hover:bg-slate-50 text-sm disabled:opacity-60"
                        disabled={busy}
                        onClick={() => onAddFavouriteFood(it)}
                      >
                        Favourite
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 border-t pt-5">
                <h3 className="text-sm font-semibold text-slate-800">Favourites</h3>
                {favFoods.length === 0 ? (
                  <p className="text-xs text-slate-500 mt-2">No favourites saved yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {favFoods.slice(0, 8).map((f) => (
                      <div
                        key={`fav-food-${f.id}`}
                        className="border rounded p-3 flex items-center justify-between gap-3"
                      >
                        <p className="text-sm text-slate-800 truncate">{f.name}</p>
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1.5 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm disabled:opacity-60"
                            disabled={busy}
                            onClick={() => onLogFavourite(f)}
                          >
                            Log
                          </button>
                          <button
                            className="px-3 py-1.5 border rounded hover:bg-slate-50 text-sm disabled:opacity-60"
                            disabled={busy}
                            onClick={() => onRemoveFavourite(f)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 border-t pt-5">
                <h3 className="text-sm font-semibold text-slate-800">Manual food log</h3>
                <p className="text-xs text-slate-500 mt-1">
                  For homemade meals / anything not in the API.
                </p>

                <input
                  className="mt-3 w-full border rounded px-3 py-2 text-sm"
                  value={foodManualName}
                  onChange={(e) => setFoodManualName(e.target.value)}
                  placeholder="Meal name (e.g. Chicken & rice)"
                />

                <input
                  className="mt-3 w-full border rounded px-3 py-2 text-sm"
                  value={foodManualCalories}
                  onChange={(e) => setFoodManualCalories(e.target.value)}
                  placeholder="Calories (optional)"
                />

                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-700">Risk tags (optional)</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Tick any that apply to this food.
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                    {renderRiskTagToggle("spicy", "Spicy")}
                    {renderRiskTagToggle("containsDairy", "Contains dairy")}
                    {renderRiskTagToggle("containsGluten", "Contains gluten")}
                    {renderRiskTagToggle("highFibre", "High fibre")}
                    {renderRiskTagToggle("highFat", "High fat")}
                    {renderRiskTagToggle("caffeine", "Caffeine")}
                    {renderRiskTagToggle("alcohol", "Alcohol")}
                    {renderRiskTagToggle("highSugar", "High sugar")}
                    {renderRiskTagToggle("highSodium", "High sodium")}
                    {renderRiskTagToggle("highIron", "High iron")}
                  </div>
                </div>

                <button
                  className="mt-3 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm disabled:opacity-60"
                  disabled={busy || foodManualName.trim().length < 2}
                  onClick={onLogFoodManual}
                >
                  Log manual food
                </button>
                <button
                  className="mt-3 ml-2 px-4 py-2 border rounded hover:bg-slate-50 text-sm disabled:opacity-60"
                  disabled={busy || foodManualName.trim().length < 2}
                  onClick={onAddFavouriteFoodManual}
                >
                  Favourite
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <RecentPanel
                title="Frequent foods"
                rows={freqFood}
                onLog={(name) => onLogFrequent("food", name)}
              />
              <RecentLogsPanel
                title="Past food logs"
                rows={recentFoods}
                onDelete={(id) => onDeleteRecent("food", id)}
                from={recentFrom}
                to={recentTo}
                onFromChange={setRecentFrom}
                onToChange={setRecentTo}
              />
            </div>
          </div>
        ) : null}

        {/* Medication */}
        {tab === "medication" ? (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-slate-700">Log date</label>
              <input
                className="mt-2 w-full border rounded px-3 py-2 text-sm"
                type="date"
                value={logDate}
                min={minLogDate}
                max={maxLogDate}
                onChange={(e) => setLogDate(e.target.value)}
              />

              <label className="text-sm font-semibold text-slate-700">Search medication</label>
              <input
                className="mt-2 w-full border rounded px-3 py-2 text-sm"
                value={medQuery}
                onChange={(e) => setMedQuery(e.target.value)}
                placeholder="Search OpenFDA / DailyMed..."
              />

              <div className="mt-3 space-y-2">
                {medResults.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Type at least 2 characters to search.
                  </p>
                ) : (
                  medResults.slice(0, 8).map((it) => (
                    <div
                      key={`med-${it.id}`}
                      className="border rounded p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {it.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {it.source ? `Source: ${it.source}` : "Source: n/a"}
                        </p>
                      </div>

                      <button
                        className="px-3 py-1.5 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm disabled:opacity-60"
                        disabled={busy}
                        onClick={() => onLogMedFromSearch(it)}
                      >
                        Log
                      </button>
                      <button
                        className="px-3 py-1.5 border rounded hover:bg-slate-50 text-sm disabled:opacity-60"
                        disabled={busy}
                        onClick={() => onAddFavouriteMed(it)}
                      >
                        Favourite
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 border-t pt-5">
                <h3 className="text-sm font-semibold text-slate-800">Favourites</h3>
                {favMeds.length === 0 ? (
                  <p className="text-xs text-slate-500 mt-2">No favourites saved yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {favMeds.slice(0, 8).map((f) => (
                      <div
                        key={`fav-med-${f.id}`}
                        className="border rounded p-3 flex items-center justify-between gap-3"
                      >
                        <p className="text-sm text-slate-800 truncate">{f.name}</p>
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1.5 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm disabled:opacity-60"
                            disabled={busy}
                            onClick={() => onLogFavourite(f)}
                          >
                            Log
                          </button>
                          <button
                            className="px-3 py-1.5 border rounded hover:bg-slate-50 text-sm disabled:opacity-60"
                            disabled={busy}
                            onClick={() => onRemoveFavourite(f)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 border-t pt-5">
                <h3 className="text-sm font-semibold text-slate-800">Manual medication log</h3>
                <p className="text-xs text-slate-500 mt-1">
                  For supplements / anything not found by the API.
                </p>

                <input
                  className="mt-3 w-full border rounded px-3 py-2 text-sm"
                  value={medManualName}
                  onChange={(e) => setMedManualName(e.target.value)}
                  placeholder="Medication name (e.g. Vitamin D)"
                />

                <input
                  className="mt-3 w-full border rounded px-3 py-2 text-sm"
                  value={medManualDose}
                  onChange={(e) => setMedManualDose(e.target.value)}
                  placeholder="Dosage (optional) e.g. 200mg"
                />

                <button
                  className="mt-3 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm disabled:opacity-60"
                  disabled={busy || medManualName.trim().length < 2}
                  onClick={onLogMedManual}
                >
                  Log manual medication
                </button>
                <button
                  className="mt-3 ml-2 px-4 py-2 border rounded hover:bg-slate-50 text-sm disabled:opacity-60"
                  disabled={busy || medManualName.trim().length < 2}
                  onClick={onAddFavouriteMedManual}
                >
                  Favourite
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <RecentPanel
                title="Frequent medications"
                rows={freqMeds}
                onLog={(name) => onLogFrequent("medication", name)}
              />
              <RecentLogsPanel
                title="Past medication logs"
                rows={recentMeds}
                onDelete={(id) => onDeleteRecent("medication", id)}
                from={recentFrom}
                to={recentTo}
                onFromChange={setRecentFrom}
                onToChange={setRecentTo}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="bg-white p-5 rounded-xl shadow mt-6">
        <p className="text-xs text-slate-500">
          Note: AI insights update as you log more data.
        </p>
      </div>
    </div>
  );
}

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-sm border ${
        active ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
};

const RecentPanel: React.FC<{
  title: string;
  rows: any[];
  onLog?: (name: string) => void;
}> = ({ title, rows, onLog }) => {
  return (
    <div className="bg-slate-50 border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600 mt-4">No entries yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.slice(0, 5).map((r, idx) => (
            <li
              key={`${title}-${idx}`}
              className="bg-white border rounded p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-slate-800 truncate">{pickDisplayName(r)}</p>
                <p className="text-xs text-slate-500 mt-1">{pickDisplayMeta(r)}</p>
              </div>
              {onLog ? (
                <button
                  className="px-3 py-1.5 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm disabled:opacity-60"
                  disabled={false}
                  onClick={() => onLog(pickDisplayName(r))}
                >
                  Log
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const RecentLogsPanel: React.FC<{
  title: string;
  rows: any[];
  onDelete: (id: number) => void;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}> = ({ title, rows, onDelete, from, to, onFromChange, onToChange }) => {
  return (
    <div className="bg-slate-50 border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span>Filter:</span>
        <input
          type="date"
          className="border rounded px-2 py-1 text-xs"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
        />
        <span>to</span>
        <input
          type="date"
          className="border rounded px-2 py-1 text-xs"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600 mt-4">No entries yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.slice(0, 5).map((r, idx) => (
            <li
              key={`${title}-recent-${idx}`}
              className="bg-white border rounded p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-slate-800 truncate">{pickDisplayName(r)}</p>
                <p className="text-xs text-slate-500 mt-1">{pickDisplayMeta(r)}</p>
              </div>
              {typeof r?.id === "number" ? (
                <button
                  className="px-3 py-1.5 border rounded hover:bg-slate-50 text-sm disabled:opacity-60"
                  disabled={false}
                  onClick={() => onDelete(r.id)}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

function toIsoFromDate(dateStr: string): string {
  try {
    const now = new Date();
    if (!dateStr) return now.toISOString();

    const min = new Date(now);
    min.setDate(min.getDate() - 30);

    const d = new Date(`${dateStr}T12:00:00`);
    if (isNaN(d.getTime())) return new Date().toISOString();
    if (d.getTime() > now.getTime()) return now.toISOString();
    if (d.getTime() < min.getTime()) return min.toISOString();
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function normalizeSearch(raw: any): SearchItem[] {
  const list = raw?.results || raw?.items || raw?.data || raw || [];
  if (!Array.isArray(list)) return [];

  return list
    .map((x: any) => {
      const id =
        x?.externalId ||
        x?.id ||
        x?.fdcId ||
        x?.code ||
        x?.productId ||
        x?.ndc ||
        x?.rxCui ||
        null;

      const name =
        x?.name ||
        x?.foodName ||
        x?.medicationName ||
        x?.brandName ||
        x?.genericName ||
        x?.description ||
        null;

      if (!id || !name) return null;

      return {
        id: String(id),
        name: String(name),
        source: x?.source ? String(x.source) : undefined,
        caloriesKcal:
          typeof x?.caloriesKcal === "number"
            ? x.caloriesKcal
            : typeof x?.calories === "number"
            ? x.calories
            : null,
        brand: x?.brand ? String(x.brand) : null,
      } as SearchItem;
    })
    .filter(Boolean) as SearchItem[];
}

function normalizeRows(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.logs)) return raw.logs;
  if (Array.isArray(raw?.rows)) return raw.rows;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function pickDisplayName(r: any): string {
  return r?.symptomName || r?.name || r?.foodName || r?.medicationName || r?.title || "Entry";
}

function pickDisplayMeta(r: any): string {
  const sev = typeof r?.severity === "number" ? `Severity: ${r.severity}` : null;
  const kcal = typeof r?.caloriesKcal === "number" ? `${r.caloriesKcal} kcal` : null;

  const rawTime = r?.loggedAt || r?.consumedAt || r?.takenAt || null;
  const time = rawTime ? safeTimeLabel(rawTime) : null;

  return [sev, kcal, time].filter(Boolean).join(" • ") || "—";
}

function safeTimeLabel(v: any): string {
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

function cleanRiskTags(tags: RiskTags | undefined): Record<string, boolean> | undefined {
  if (!tags) return undefined;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(tags)) {
    if (v) out[k] = true;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export default DailyLog;