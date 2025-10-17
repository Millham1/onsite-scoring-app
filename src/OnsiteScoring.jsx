import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

// Score grids
const EVEN_2_40 = Array.from({ length: 20 }, (_, i) => 2 + i * 2); // 2,4,...,40
const MULT_4_80 = Array.from({ length: 20 }, (_, i) => 4 + i * 4); // 4,8,...,80
const EXTRA_SCORES = [70, 74, 78];
const MOISTURE_SKIN_MEAT_SCORES = [
  ...MULT_4_80,
  ...EXTRA_SCORES.filter(s => !MULT_4_80.includes(s)),
].sort((a, b) => a - b);

const COMPLETENESS_CATEGORIES = [
  { key: "site_clean", label: "Site Clean" },
  { key: "knives", label: "Knives" },
  { key: "sauce_cups", label: "Sauce Cups" },
  { key: "drinks_towels", label: "Drinks & Towels" },
  { key: "thermometers", label: "Thermometers" }
];

const initialForm = {
  team_id: "",
  site_number: "",
  judge_id: "",
  appearance: "",
  color: "",
  skin: "",
  moisture: "",
  taste: "",
  completeness: {},
  suitable: "",
  failOverride: false,
};

function OnsiteScoring() {
  const [form, setForm] = useState(initialForm);
  const [teams, setTeams] = useState([]);
  const [judges, setJudges] = useState([]);
  const [message, setMessage] = useState("");
  const [failFlag, setFailFlag] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOptions() {
      setLoading(true);
      const { data: teamsData } = await supabase.from("teams").select("*");
      const { data: judgesData } = await supabase.from("judges").select("*");
      setTeams(teamsData || []);
      setJudges(judgesData || []);
      setLoading(false);
    }
    fetchOptions();
  }, []);

  useEffect(() => {
    if (form.suitable === "No" && !form.failOverride) {
      setFailFlag(true);
      setForm((f) => ({
        ...f,
        appearance: "",
        color: "",
        skin: "",
        moisture: "",
        taste: "",
        completeness: {},
      }));
    } else {
      setFailFlag(false);
    }
  }, [form.suitable, form.failOverride]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCompletenessChange = (catKey, checked) => {
    setForm((prev) => ({
      ...prev,
      completeness: { ...prev.completeness, [catKey]: checked }
    }));
  };

  const handleFailOverride = () => {
    setForm((prev) => ({ ...prev, failOverride: true }));
    setFailFlag(false);
  };

  async function validateDuplicate() {
    const { data: siteDup } = await supabase
      .from("onsite_scores")
      .select("*")
      .eq("team_id", form.team_id)
      .eq("site_number", form.site_number);
    if (siteDup && siteDup.length > 0) {
      setMessage("Duplicate team/site entry!");
      return false;
    }
    for (let cat of ["appearance", "color", "skin", "moisture", "taste"]) {
      if (form[cat]) {
        const { data: dup } = await supabase
          .from("onsite_scores")
          .select("*")
          .eq("team_id", form.team_id)
          .eq("judge_id", form.judge_id)
          .eq(cat, form[cat]);
        if (dup && dup.length > 0) {
          setMessage(`Duplicate score for ${cat} by this team/judge!`);
          return false;
        }
      }
    }
    return true;
  }

  const handleSave = async () => {
    setMessage("");
    if (
      !form.team_id ||
      !form.site_number ||
      !form.judge_id ||
      !form.suitable
    ) {
      setMessage("Please fill out Team, Site, Judge, and Suitability.");
      return;
    }
    const valid = await validateDuplicate();
    if (!valid) return;

    const scoreRow = {
      team_id: form.team_id,
      judge_id: form.judge_id,
      appearance: form.appearance || null,
      color: form.color || null,
      skin: form.skin || null,
      moisture: form.moisture || null,
      taste: form.taste || null,
      site_number: form.site_number,
      created_at: new Date().toISOString(),
      ...Object.fromEntries(
        COMPLETENESS_CATEGORIES.map(({ key }) => [
          key,
          form.completeness[key] ? 8 : 0
        ])
      )
    };

    const { error } = await supabase
      .from("onsite_scores")
      .insert([scoreRow]);
    if (error) {
      setMessage("Error saving: " + error.message);
    } else {
      setMessage("Saved!");
      setForm(initialForm);
      setFailFlag(false);
    }
  };

  const Dropdown = ({ options, value, onChange, label, idKey, nameKey }) => (
    <div style={{ marginBottom: 10 }}>
      <label>
        {label}:
        {value ? (
          <span style={{ fontWeight: "bold", marginLeft: 6 }}>
            {options.find((o) => o[idKey] === value)?.[nameKey] || value}
          </span>
        ) : (
          <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            style={{ minWidth: 120 }}
          >
            <option value="">Select</option>
            {options.map((opt) => (
              <option key={opt[idKey]} value={opt[idKey]}>
                {opt[nameKey]}
              </option>
            ))}
          </select>
        )}
      </label>
    </div>
  );

  const ScoreGrid = ({ scores, value, onChange, label, disabled }) => (
    <div style={{ marginBottom: 10 }}>
      <label>{label}:</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {scores.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            style={{
              padding: "4px 10px",
              background: value === s ? "#aaf" : "#eee",
              border: "1px solid #ccc",
              borderRadius: 4,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
            onClick={() => onChange(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {value && (
        <span style={{ marginLeft: 12, fontWeight: "bold", color: "#333" }}>
          Selected: {value}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 640, margin: "30px auto", padding: 24, background: "#fff", borderRadius: 8, boxShadow: "0 4px 24px #0001" }}>
      <h2>Onsite Scoring Sheet</h2>

      {loading ? (
        <div>Loading options...</div>
      ) : (
        <>
          <Dropdown
            label="Team"
            options={teams}
            value={form.team_id}
            onChange={(v) => {
              const selected = teams.find((t) => t.id === Number(v));
              handleChange("team_id", Number(v));
              handleChange("site_number", selected?.site_number || "");
            }}
            idKey="id"
            nameKey="name"
          />
          <Dropdown
            label="Site"
            options={teams}
            value={form.site_number}
            onChange={(v) => handleChange("site_number", v)}
            idKey="site_number"
            nameKey="site_number"
          />
          <Dropdown
            label="Judge"
            options={judges}
            value={form.judge_id}
            onChange={(v) => handleChange("judge_id", Number(v))}
            idKey="id"
            nameKey="name"
          />

          <div style={{ marginBottom: 16 }}>
            <label>
              Suitable for Consumption: {" "}
              <select
                value={form.suitable}
                onChange={(e) => handleChange("suitable", e.target.value)}
                style={{ minWidth: 120 }}
              >
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </label>
          </div>

          {failFlag && (
            <div style={{ background: "#fdd", padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <strong>Fail: Not suitable for consumption.</strong>
              <br />
              <button
                onClick={handleFailOverride}
                style={{
                  marginTop: 8,
                  background: "#faa", border: "1px solid #c00", borderRadius: 4, padding: "4px 12px"
                }}
              >
                Continue Scoring Anyway
              </button>
            </div>
          )}

          <ScoreGrid
            label="Appearance"
            scores={EVEN_2_40}
            value={form.appearance}
            onChange={(v) => handleChange("appearance", v)}
            disabled={form.suitable === "No" && !form.failOverride}
          />
          <ScoreGrid
            label="Color"
            scores={EVEN_2_40}
            value={form.color}
            onChange={(v) => handleChange("color", v)}
            disabled={form.suitable === "No" && !form.failOverride}
          />
          <ScoreGrid
            label="Skin"
            scores={MOISTURE_SKIN_MEAT_SCORES}
            value={form.skin}
            onChange={(v) => handleChange("skin", v)}
            disabled={form.suitable === "No" && !form.failOverride}
          />
          <ScoreGrid
            label="Moisture"
            scores={MOISTURE_SKIN_MEAT_SCORES}
            value={form.moisture}
            onChange={(v) => handleChange("moisture", v)}
            disabled={form.suitable === "No" && !form.failOverride}
          />
          <ScoreGrid
            label="Meat & Sauce"
            scores={MOISTURE_SKIN_MEAT_SCORES}
            value={form.taste}
            onChange={(v) => handleChange("taste", v)}
            disabled={form.suitable === "No" && !form.failOverride}
          />

          <div style={{ marginBottom: 10 }}>
            <label>Completeness:</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {COMPLETENESS_CATEGORIES.map(({ key, label }) => (
                <label key={key} style={{ fontWeight: "normal" }}>
                  <input
                    type="checkbox"
                    checked={!!form.completeness[key]}
                    disabled={form.suitable === "No" && !form.failOverride}
                    onChange={(e) =>
                      handleCompletenessChange(key, e.target.checked)
                    }
                  />
                  {label} (+8)
                </label>
              ))}
            </div>
          </div>

          <button
            style={{
              marginTop: 18,
              padding: "8px 22px",
              background: "#4caf50",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 16,
              cursor: "pointer",
            }}
            onClick={handleSave}
            disabled={
              !form.team_id ||
              !form.site_number ||
              !form.judge_id ||
              !form.suitable
            }
          >
            Save Entry
          </button>

          {message && (
            <div style={{
              marginTop: 16,
              color: message === "Saved!" ? "green" : "red",
              fontWeight: "bold"
            }}>
              {message}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default OnsiteScoring;