import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addDoctorPatientNote,
  deleteDoctorPatientNote,
  getDoctorAiSummary,
  getDoctorPatientHistory,
} from "../services/Api";

type HistoryResponse = {
  patient: { id: number; email: string };
  assignment: { id: number; status: "ACTIVE" };
  profileSummary: {
    dateOfBirth: string | null;
    age: number | null;
    heightCm: number | null;
    weightKg: number | null;
    bloodType: string | null;
    gender: string | null;
    chronicConditions: string | null;
    allergies: string | null;
    medicalHistorySummary: string | null;
  } | null;
  symptoms: { count: number; items: any[] };
  foodLogs: { count: number; items: any[] };
  medicationLogs: { count: number; items: any[] };
  notes: { count: number; items: Array<{ id: number; body: string; createdAt: string }> };
};

type DoctorAiSummary = {
  patientId: number;
  days: number;
  summary?: {
    counts?: {
      foodsLogged: number;
      medicationsLogged: number;
      symptomsLogged: number;
    };
    topFoods?: Array<{ name: string; count: number }>;
    topMedications?: Array<{ name: string; count: number }>;
  };
};

const formatDate = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const formatDateOnly = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-IE");
};

const EmptyState = ({ label }: { label: string }) => (
  <p className="text-sm text-slate-600">{label}</p>
);

const hasProfileSummaryData = (profileSummary: HistoryResponse["profileSummary"]) => {
  if (!profileSummary) return false;
  return Boolean(
    profileSummary.dateOfBirth ||
      profileSummary.age !== null ||
      profileSummary.heightCm !== null ||
      profileSummary.weightKg !== null ||
      profileSummary.bloodType ||
      profileSummary.gender ||
      profileSummary.chronicConditions ||
      profileSummary.allergies ||
      profileSummary.medicalHistorySummary
  );
};

function DoctorPatientHistory() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [aiSummary, setAiSummary] = useState<DoctorAiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteStatus, setNoteStatus] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);

  // Fetches patient history and AI summary for an assigned patient
  // backend enforces RBAC and ACTIVE doctor-patient assignment
  const loadHistory = async (parsedPatientId: number, mounted?: () => boolean) => {
    const result = await getDoctorPatientHistory(parsedPatientId, {
      days: 30,
      limit: 10,
    });
    if (mounted && !mounted()) return;
    setHistory(result);

    try {
      const summary = await getDoctorAiSummary(parsedPatientId, 30);
      if (!mounted || mounted()) setAiSummary(summary);
    } catch {
      if (!mounted || mounted()) setAiSummary(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadPage = async () => {
      const parsedPatientId = parseInt(String(patientId), 10);
      if (!Number.isFinite(parsedPatientId) || parsedPatientId <= 0) {
        setMessage("Invalid patient id.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        await loadHistory(parsedPatientId, () => mounted);
      } catch (err: any) {
        if (!mounted) return;
        setMessage(err?.error || "Could not load patient history.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPage();

    return () => {
      mounted = false;
    };
  }, [patientId]);

  // Adds a doctor note for this patient for docotr to keep tabs on (validated on backend)
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoteStatus("");

    const parsedPatientId = parseInt(String(patientId), 10);
    if (!Number.isFinite(parsedPatientId) || parsedPatientId <= 0) {
      setNoteStatus("Invalid patient id.");
      return;
    }

    const body = noteBody.trim();
    if (!body) {
      setNoteStatus("Enter a note before saving.");
      return;
    }

    if (body.length > 1000) {
      setNoteStatus("Notes must be 1000 characters or fewer.");
      return;
    }

    try {
      setSavingNote(true);
      await addDoctorPatientNote(parsedPatientId, body);
      setNoteBody("");
      await loadHistory(parsedPatientId);
      setNoteStatus("Note added.");
    } catch (err: any) {
      setNoteStatus(err?.error || "Could not add note.");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    const parsedPatientId = parseInt(String(patientId), 10);
    if (!Number.isFinite(parsedPatientId) || parsedPatientId <= 0) {
      setNoteStatus("Invalid patient id.");
      return;
    }

    try {
      setDeletingNoteId(noteId);
      setNoteStatus("");
      await deleteDoctorPatientNote(parsedPatientId, noteId);
      await loadHistory(parsedPatientId);
      setNoteStatus("Note deleted.");
    } catch (err: any) {
      setNoteStatus(err?.error || "Could not delete note.");
    } finally {
      setDeletingNoteId(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-100 p-8">Loading patient history...</div>;
  }

  if (message || !history) {
    return (
      <div className="min-h-screen bg-slate-100 p-8 max-w-6xl mx-auto">
        <button
          onClick={() => navigate("/doctor")}
          className="mb-4 px-3 py-2 bg-slate-900 text-white rounded text-sm hover:bg-slate-800"
        >
          Back to dashboard
        </button>
        <div className="bg-white p-6 rounded-xl shadow">
          <p className="text-sm text-slate-700">{message || "Patient history unavailable."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-8 max-w-6xl mx-auto">
      <button
        onClick={() => navigate("/doctor")}
        className="mb-4 px-3 py-2 bg-slate-900 text-white rounded text-sm hover:bg-slate-800"
      >
        Back to dashboard
      </button>

      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <h1 className="text-2xl font-bold">Patient History</h1>
        <p className="text-sm text-slate-600 mt-1">
          Read-only history for {history.patient.email}. Access is limited to active assignments.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Overview</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p><span className="font-medium">Patient:</span> {history.patient.email}</p>
            <p><span className="font-medium">Patient ID:</span> {history.patient.id}</p>
            <p><span className="font-medium">Assignment:</span> {history.assignment.status}</p>
            {!hasProfileSummaryData(history.profileSummary) ? (
              <p><span className="font-medium">Profile summary:</span> Not provided</p>
            ) : (
              <div className="space-y-2">
                <p className="font-medium">Profile summary</p>
                {history.profileSummary?.age !== null || history.profileSummary?.dateOfBirth ? (
                  <p>
                    Age: {history.profileSummary?.age ?? "-"}
                    {history.profileSummary?.dateOfBirth ? ` | DOB: ${history.profileSummary.dateOfBirth}` : ""}
                  </p>
                ) : null}
                {history.profileSummary?.heightCm !== null ? (
                  <p>Height: {history.profileSummary?.heightCm} cm</p>
                ) : null}
                {history.profileSummary?.weightKg !== null ? (
                  <p>Weight: {history.profileSummary?.weightKg} kg</p>
                ) : null}
                {history.profileSummary?.bloodType ? (
                  <p>Blood type: {history.profileSummary.bloodType.replace("_POS", "+").replace("_NEG", "-")}</p>
                ) : null}
                {history.profileSummary?.gender ? (
                  <p>Biological sex: {history.profileSummary.gender}</p>
                ) : null}
                {history.profileSummary?.chronicConditions ? (
                  <p className="whitespace-pre-wrap break-words">Conditions: {history.profileSummary.chronicConditions}</p>
                ) : null}
                {history.profileSummary?.allergies ? (
                  <p className="whitespace-pre-wrap break-words">Allergies: {history.profileSummary.allergies}</p>
                ) : null}
                {history.profileSummary?.medicalHistorySummary ? (
                  <p className="whitespace-pre-wrap break-words">
                    Medical history: {history.profileSummary.medicalHistorySummary}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Patient Summary</h2>
          {!aiSummary?.summary ? (
            <EmptyState label="No AI summary available." />
          ) : (
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p>
                Foods: {aiSummary.summary.counts?.foodsLogged ?? 0} | Medications:{" "}
                {aiSummary.summary.counts?.medicationsLogged ?? 0} | Symptoms:{" "}
                {aiSummary.summary.counts?.symptomsLogged ?? 0}
              </p>
              <div>
                <p className="font-medium">Top foods</p>
                {(aiSummary.summary.topFoods || []).length === 0 ? (
                  <EmptyState label="No top foods in this window." />
                ) : (
                  <ul className="list-disc pl-5">
                    {(aiSummary.summary.topFoods || []).map((item) => (
                      <li key={item.name}>{item.name} ({item.count})</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="font-medium">Top medications</p>
                {(aiSummary.summary.topMedications || []).length === 0 ? (
                  <EmptyState label="No top medications in this window." />
                ) : (
                  <ul className="list-disc pl-5">
                    {(aiSummary.summary.topMedications || []).map((item) => (
                      <li key={item.name}>{item.name} ({item.count})</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="bg-white p-6 rounded-xl shadow md:col-span-2">
          <h2 className="text-lg font-semibold">Symptoms ({history.symptoms.count})</h2>
          <p className="mt-2 text-sm text-slate-600">Recent history (latest 10 entries)</p>
          {history.symptoms.items.length === 0 ? (
            <EmptyState label="No symptom logs in this window." />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border rounded text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3 text-left">Symptom</th>
                    <th className="p-3 text-left">Severity</th>
                    <th className="p-3 text-left">Logged</th>
                    <th className="p-3 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.symptoms.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">{item.symptomName}</td>
                      <td className="p-3">{item.severity}</td>
                      <td className="p-3">{formatDateOnly(item.loggedAt)}</td>
                      <td className="p-3">{item.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white p-6 rounded-xl shadow md:col-span-2">
          <h2 className="text-lg font-semibold">Food Logs ({history.foodLogs.count})</h2>
          <p className="mt-2 text-sm text-slate-600">Recent history (latest 10 entries)</p>
          {history.foodLogs.items.length === 0 ? (
            <EmptyState label="No food logs in this window." />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border rounded text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3 text-left">Food</th>
                    <th className="p-3 text-left">Brand</th>
                    <th className="p-3 text-left">Calories</th>
                    <th className="p-3 text-left">Logged</th>
                  </tr>
                </thead>
                <tbody>
                  {history.foodLogs.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">{item.name}</td>
                      <td className="p-3">{item.brand || "-"}</td>
                      <td className="p-3">{item.caloriesKcal ?? "-"}</td>
                      <td className="p-3">{formatDateOnly(item.consumedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white p-6 rounded-xl shadow md:col-span-2">
          <h2 className="text-lg font-semibold">
            Medication Logs ({history.medicationLogs.count})
          </h2>
          <p className="mt-2 text-sm text-slate-600">Recent history (latest 10 entries)</p>
          {history.medicationLogs.items.length === 0 ? (
            <EmptyState label="No medication logs in this window." />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border rounded text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3 text-left">Medication</th>
                    <th className="p-3 text-left">Dose</th>
                    <th className="p-3 text-left">Logged</th>
                  </tr>
                </thead>
                <tbody>
                  {history.medicationLogs.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">{item.medicationName}</td>
                      <td className="p-3">
                        {item.doseQty !== null && item.doseQty !== undefined
                          ? `${item.doseQty}${item.doseUnit ? ` ${item.doseUnit}` : ""}`
                          : item.doseUnit || "-"}
                      </td>
                      <td className="p-3">{formatDateOnly(item.takenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Doctor Notes</h2>
          <p className="mt-2 text-sm text-slate-600">Recent history (latest 10 entries)</p>
          <form onSubmit={handleAddNote} className="mt-4 space-y-3">
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              maxLength={1000}
              className="w-full border rounded p-2 text-sm min-h-24"
              placeholder="Record a short note for this patient's history"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingNote}
                className="px-3 py-2 text-sm bg-slate-900 text-white rounded hover:bg-slate-800 disabled:bg-slate-500"
              >
                {savingNote ? "Saving..." : "Save Note"}
              </button>
            </div>
            {noteStatus ? <p className="text-sm text-slate-700">{noteStatus}</p> : null}
          </form>

          <div className="mt-5 space-y-3">
            {history.notes.items.length === 0 ? (
              <EmptyState label="No doctor notes for this patient yet." />
            ) : (
              history.notes.items.map((note) => (
                <div key={note.id} className="border rounded p-3">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{note.body}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">{formatDate(note.createdAt)}</p>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      disabled={deletingNoteId === note.id}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default DoctorPatientHistory;