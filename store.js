// Shared logic: ID parsing, storage (local demo mode or Firebase Firestore via REST), admin sign-in
(function () {
  const C = window.VOTE_CONFIG, fb = C.firebase;
  const norm = id => String(id).replace(/\s+/g, "").toUpperCase();
  const ID_OK = /^(?=.*\d)[A-Z0-9]{5,20}$/;

  const ls = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  };

  // ---------- ID parsing: single IDs and ranges like 224NSK1100001-224NSK1100130 ----------
  function parseIds(text) {
    const tokens = String(text).toUpperCase()
      .replace(/\s*-\s*/g, "-")
      .split(/\s+|,|;|\bOR\b/).filter(Boolean);
    const set = new Set(), invalid = [];
    for (const t of tokens) {
      if (t.includes("-")) {
        const m = /^([A-Z0-9]*?[A-Z])(\d+)-([A-Z0-9]*?[A-Z])(\d+)$/.exec(t);
        if (!m || m[1] !== m[3] || m[2].length !== m[4].length || +m[2] > +m[4] || +m[4] - +m[2] >= 20000) {
          invalid.push(t); continue;
        }
        for (let n = +m[2]; n <= +m[4]; n++) set.add(m[1] + String(n).padStart(m[2].length, "0"));
      } else if (ID_OK.test(t)) set.add(t);
      else invalid.push(t);
    }
    return { ids: [...set], invalid };
  }

  function configRangesText() {
    return (C.allowedRanges || []).map(r => {
      const a = r.prefix + String(r.from).padStart(7, "0"), b = r.prefix + String(r.to).padStart(7, "0");
      return a + "-" + b;
    }).join("\n");
  }

  // ---------- Firestore REST helpers ----------
  const DB = fb ? `projects/${fb.projectId}/databases/(default)/documents` : null;
  const BASE = fb ? `https://firestore.googleapis.com/v1/${DB}` : null;
  const KEY = fb ? `key=${encodeURIComponent(fb.apiKey)}` : "";
  let token = null, tokenExp = 0;
  try { token = sessionStorage.getItem("adminToken"); tokenExp = +sessionStorage.getItem("adminExp") || 0; } catch {}
  if (Date.now() > tokenExp) token = null;

  async function api(path, opts = {}, admin = false) {
    const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}${KEY}`;
    const headers = { "Content-Type": "application/json" };
    if (admin && token) headers.Authorization = "Bearer " + token;
    const r = await fetch(url, { ...opts, headers });
    if (admin && (r.status === 401 || r.status === 403))
      throw new Error("Not authorised. Please sign in again as the admin (and check the Firestore rules).");
    return r;
  }

  const NET = "Could not reach the voting server. Please try again.";

  // ---------- Voter side ----------
  async function isAllowed(id) {
    id = norm(id);
    if (!ID_OK.test(id)) return false;
    if (!fb) {
      const p = ls.get("participants", null);
      return (p && p.length ? p : parseIds(configRangesText()).ids).includes(id);
    }
    const r = await api(`/participants/${id}`);
    if (r.status === 200) return true;
    if (r.status === 404) return false;
    throw new Error(NET);
  }

  async function hasVoted(id) {
    id = norm(id);
    if (!fb) return ls.get("voters", []).includes(id);
    const r = await api(`/voters/${id}`);
    if (r.status === 200) return true;
    if (r.status === 404) return false;
    throw new Error(NET);
  }

  // Marks the ID as used. Returns false if it was already used.
  async function claimVoter(id) {
    id = norm(id);
    if (!fb) {
      const v = ls.get("voters", []);
      if (v.includes(id)) return false;
      v.push(id); ls.set("voters", v); return true;
    }
    const r = await api(`/voters?documentId=${id}`, {
      method: "POST",
      body: JSON.stringify({ fields: { ts: { timestampValue: new Date().toISOString() } } })
    });
    if (r.status === 409) return false;
    if (!r.ok) throw new Error(NET);
    return true;
  }

  // Ballots are stored separately and are NOT linked to the voter's ID.
  async function saveBallot(choices) {
    if (!fb) { const b = ls.get("ballots", []); b.push(choices); ls.set("ballots", b); return; }
    const fields = {};
    for (const [k, v] of Object.entries(choices)) fields[k] = { stringValue: v };
    const r = await api(`/ballots`, { method: "POST", body: JSON.stringify({ fields }) });
    if (!r.ok) throw new Error("Could not save your ballot. Please try again.");
  }

  // ---------- Election open/closed switch ----------
  async function isElectionOpen() {
    if (!fb) return ls.get("electionOpen", true);
    const r = await api(`/settings/election`);
    if (r.status === 404) return true;            // never set = open
    if (!r.ok) throw new Error(NET);
    const j = await r.json();
    return !(j.fields && j.fields.open && j.fields.open.booleanValue === false);
  }
  async function setElectionOpen(open) {
    if (!fb) { ls.set("electionOpen", !!open); return; }
    const r = await api(`/settings/election?updateMask.fieldPaths=open`, {
      method: "PATCH", body: JSON.stringify({ fields: { open: { booleanValue: !!open } } })
    }, true);
    if (!r.ok) throw new Error("Could not change the election status (" + r.status + ").");
  }

  // ---------- Admin side ----------
  async function signIn(email, password) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?${KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    if (!r.ok) throw new Error("Wrong email or password.");
    const j = await r.json();
    token = j.idToken; tokenExp = Date.now() + (+j.expiresIn - 60) * 1000;
    try { sessionStorage.setItem("adminToken", token); sessionStorage.setItem("adminExp", tokenExp); } catch {}
  }
  function signOut() { token = null; try { sessionStorage.clear(); } catch {} }
  const signedIn = () => !fb || (!!token && Date.now() < tokenExp);

  async function listDocs(col, mapDoc) {
    const out = []; let page = "";
    do {
      const r = await api(`/${col}?pageSize=300${page ? "&pageToken=" + page : ""}`, {}, true);
      if (!r.ok) throw new Error("Could not load data.");
      const j = await r.json();
      for (const d of j.documents || []) out.push(mapDoc(d));
      page = j.nextPageToken || "";
    } while (page);
    return out;
  }
  const docId = d => d.name.split("/").pop();

  async function listParticipants() {
    if (!fb) return ls.get("participants", []);
    return listDocs("participants", docId);
  }
  async function listVoters() {
    if (!fb) return ls.get("voters", []);
    return listDocs("voters", docId);
  }
  async function loadBallots() {
    if (!fb) return ls.get("ballots", []);
    return listDocs("ballots", d => {
      const c = {};
      for (const [k, v] of Object.entries(d.fields || {})) c[k] = v.stringValue;
      return c;
    });
  }

  async function commit(writes) {
    for (let i = 0; i < writes.length; i += 400) {
      const r = await api(`:commit`, { method: "POST", body: JSON.stringify({ writes: writes.slice(i, i + 400) }) }, true);
      if (!r.ok) throw new Error("Upload failed (" + r.status + ").");
    }
  }
  async function addParticipants(ids) {
    if (!fb) { ls.set("participants", [...new Set([...ls.get("participants", []), ...ids])]); return; }
    const now = new Date().toISOString();
    await commit(ids.map(id => ({ update: { name: `${DB}/participants/${id}`, fields: { added: { timestampValue: now } } } })));
  }
  async function removeParticipants(ids) {
    if (!fb) { const s = new Set(ids); ls.set("participants", ls.get("participants", []).filter(x => !s.has(x))); return; }
    await commit(ids.map(id => ({ delete: `${DB}/participants/${id}` })));
  }

  window.VoteStore = {
    norm, parseIds, configRangesText, isElectionOpen, setElectionOpen, isAllowed, hasVoted, claimVoter, saveBallot,
    signIn, signOut, signedIn, listParticipants, listVoters, loadBallots, addParticipants, removeParticipants
  };
})();
