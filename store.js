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
      if (typeof r === "string") return r;                       // "224NSK1100001-224NSK1100300"
      const a = r.prefix + String(r.from).padStart(7, "0"), b = r.prefix + String(r.to).padStart(7, "0");
      return a + "-" + b;                                        // old { prefix, from, to } form
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
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
    let r;
    try { r = await fetch(url, { ...opts, headers, signal: ctl.signal }); }
    catch (e) { throw new Error("Cannot reach the voting database. Check your internet connection and try again."); }
    finally { clearTimeout(timer); }
    if (admin && (r.status === 401 || r.status === 403))
      throw new Error("Not authorised. Please sign in again as the admin (and check the Firestore rules).");
    return r;
  }

  // Turn an unexpected Firestore response into a message that says what to fix
  async function bad(r) {
    let m = ""; try { const j = await r.clone().json(); m = (j.error && j.error.message) || ""; } catch (e) {}
    if (r.status === 400 && /api key/i.test(m)) throw new Error("The apiKey in config.js is not valid. Copy it again from Firebase > Project settings.");
    if (/has not been used|is disabled|does not exist for project|database.*not.*(exist|found)/i.test(m) || (r.status === 404 && /database/i.test(m)))
      throw new Error("The Firestore database has not been created yet. In Firebase open Databases & Storage > Firestore Database > Create database.");
    if (r.status === 403) throw new Error("The database refused access. In Firebase open Firestore Database > Rules, paste the rules from firestore.rules, and click Publish.");
    throw new Error("Voting server error (" + r.status + "). Please try again.");
  }
  async function dbMissing(r) {   // is this 404 a missing database, rather than a missing document?
    try { const j = await r.clone().json(); return /database/i.test((j.error && j.error.message) || ""); } catch (e) { return false; }
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
    if (r.status === 404) { if (await dbMissing(r)) await bad(r); return false; }
    await bad(r);
  }

  async function hasVoted(id) {
    id = norm(id);
    if (!fb) return ls.get("voters", []).includes(id);
    const r = await api(`/voters/${id}`);
    if (r.status === 200) return true;
    if (r.status === 404) return false;
    await bad(r);
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
    if (r.status === 403) throw new Error("Your vote was not accepted. Voting may have just been closed, or this ID is not on the voter list.");
    if (!r.ok) await bad(r);
    return true;
  }

  // Ballots are stored separately and are NOT linked to the voter's ID.
  async function saveBallot(choices) {
    if (!fb) { const b = ls.get("ballots", []); b.push(choices); ls.set("ballots", b); return; }
    const fields = {};
    for (const [k, v] of Object.entries(choices)) fields[k] = { stringValue: v };
    const r = await api(`/ballots`, { method: "POST", body: JSON.stringify({ fields }) });
    if (r.status === 403) throw new Error("Your vote was not accepted. Voting may have just been closed.");
    if (!r.ok) await bad(r);
  }

  // ---------- Admin passcode (used when no Firebase login is available) ----------
  async function hashPass(p) {
    const d = new TextEncoder().encode("nursa-admin:" + String(p).trim());
    const b = await crypto.subtle.digest("SHA-256", d);
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }

  // ---------- Election open/closed switch ----------
  async function isElectionOpen() {
    if (!fb) return ls.get("electionOpen", true);
    const r = await api(`/settings/election`);
    if (r.status === 404) return true;            // never set = open
    if (!r.ok) await bad(r);
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
      if (!r.ok) throw new Error("Could not load " + col + " (error " + r.status + ").");
      const j = await r.json();
      for (const d of j.documents || []) out.push(mapDoc(d));
      page = j.nextPageToken || "";
    } while (page);
    return out;
  }
  const docId = d => d.name.split("/").pop();

  async function listParticipants() {
    if (!fb) { const p = ls.get("participants", []); return p.length ? p : parseIds(configRangesText()).ids; }
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

  // ---------- election status (open/closed + round number) ----------
  async function electionStatus() { return { open: await isElectionOpen(), round: fb ? 1 : ls.get("round", 1) }; }
  // Browser-only (demo) mode: clear this browser's votes and start the next round
  async function resetDemoElection() { ls.set("ballots", []); ls.set("voters", []); ls.set("round", ls.get("round", 1) + 1); ls.set("electionOpen", true); }

  // ====================== Google Sheets mode (Apps Script web app) ======================
  const sx = C.sheets;
  const SHEETS_NET = "Cannot reach the voting server. Check your internet connection and try again.";
  async function call(payload) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 30000);
    let r;
    try {
      // No Content-Type header on purpose: keeps it a "simple" request (no CORS preflight).
      r = await fetch(sx.url, { method: "POST", body: JSON.stringify(payload), signal: ctl.signal });
    } catch (e) { throw new Error(SHEETS_NET); }
    finally { clearTimeout(timer); }
    if (!r.ok) throw new Error(SHEETS_NET);
    let j; try { j = await r.json(); } catch (e) { throw new Error("The voting server sent an unexpected reply. In Apps Script, check the web app is deployed with access set to Anyone."); }
    if (j.error === "unauthorised") throw new Error("Not authorised. Please sign in again.");
    if (j.error) throw new Error(j.error);
    return j;
  }
  let pw = null;
  try { pw = sessionStorage.getItem("sheetsPw"); } catch (e) {}
  const adminCall = p => call({ ...p, pw });
  let lastCheck = null;                                       // isAllowed + hasVoted share one request
  async function checkId(id, code) {
    id = norm(id); code = String(code || "");
    if (lastCheck && lastCheck.id === id && lastCheck.code === code && Date.now() - lastCheck.t < 20000) return lastCheck.v;
    const v = await call({ action: "check", id, code });
    lastCheck = { id, code, v, t: Date.now() };
    return v;
  }

  const sheetsStore = {
    norm, parseIds, configRangesText, hashPass,
    async electionStatus() { const j = await call({ action: "status" }); return { open: j.open !== false, round: j.round || 1, codes: !!j.codes }; },
    async isElectionOpen() { return (await this.electionStatus()).open; },
    async setElectionOpen(open) { await adminCall({ action: "setOpen", open: !!open }); },
    async isAllowed(id, code) { id = norm(id); if (!ID_OK.test(id)) return false; this._code = code || ""; return !!(await checkId(id, code)).allowed; },
    async hasVoted(id) { return !!(await checkId(id, this._code)).voted; },
    // The server does the "already voted?" check and the write in one locked step (saveBallot),
    // so claimVoter only remembers the ID here.
    async claimVoter(id) { this._id = norm(id); lastCheck = null; return true; },
    async saveBallot(choices) {
      try { await call({ action: "vote", id: this._id, choices, code: this._code || "" }); }
      catch (e) { throw new Error(e.message === "already voted" ? "This ID has already voted." : e.message); }
    },
    async signIn(email, password) {
      pw = password;
      try { await adminCall({ action: "login" }); }
      catch (e) {
        pw = null;
        if (/Not authorised/.test(e.message)) throw new Error("Wrong password.");
        throw new Error("Could not sign in: " + e.message + " (this is not a password problem; check the Apps Script deployment)");
      }
      try { sessionStorage.setItem("sheetsPw", pw); } catch (e) {}
    },
    signOut() { pw = null; try { sessionStorage.clear(); } catch (e) {} },
    signedIn: () => !!pw,
    async listParticipants() { return (await adminCall({ action: "list", what: "participants" })).items; },
    async listVoters() { return (await adminCall({ action: "list", what: "voters" })).items; },
    async loadBallots() { return (await adminCall({ action: "list", what: "ballots" })).items; },
    async addParticipants(ids) { for (let i = 0; i < ids.length; i += 2000) await adminCall({ action: "add", ids: ids.slice(i, i + 2000) }); },
    async removeParticipants(ids) { for (let i = 0; i < ids.length; i += 2000) await adminCall({ action: "remove", ids: ids.slice(i, i + 2000) }); },
    async allowRevote(id) {
      try { return (await adminCall({ action: "unvote", id: norm(id) })).removed; }
      catch (e) { throw new Error(/unknown action/i.test(e.message) ? "Your Google script has not been updated yet. In Apps Script choose Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy, then try again." : e.message); }
    },
    // voting codes (admin)
    async setPhones(pairs) { return adminCall({ action: "setPhones", pairs }); },
    async generateCodes(all) { return (await adminCall({ action: "genCodes", all: !!all })).made; },
    async exportCodes() { return (await adminCall({ action: "exportCodes" })).items; },
    async setCodesRequired(on) {
      try { await adminCall({ action: "setCodes", on: !!on }); }
      catch (e) { throw new Error(/unknown action/i.test(e.message) ? "Your Google script has not been updated yet. In Apps Script choose Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy, then try again." : e.message); }
    },
    async resetElection() {
      try { await adminCall({ action: "reset" }); }
      catch (e) { throw new Error(/unknown action/i.test(e.message) ? "Your Google script has not been updated yet. In Apps Script choose Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy, then try again." : e.message); }
    }
  };

  const standard = {
    norm, parseIds, configRangesText, hashPass, isElectionOpen, setElectionOpen, electionStatus, isAllowed, hasVoted, claimVoter, saveBallot,
    signIn, signOut, signedIn, listParticipants, listVoters, loadBallots, addParticipants, removeParticipants
  };
  if (!fb) standard.resetElection = resetDemoElection;
  window.VoteStore = sx ? sheetsStore : standard;
})();
