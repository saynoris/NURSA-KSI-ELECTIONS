// Voting backend for Google Sheets.
// Paste into: Google Sheet -> Extensions -> Apps Script. See README "Google Sheets mode".
//
// Sheets used (created automatically by setup()):
//   Participants : A = eligible student ID
//   Voters       : A = ID that has voted, B = time      (who voted, NOT how)
//   Ballots      : A = JSON of choices                  (how people voted, NOT who)
//   Settings     : A1 = "open", B1 = TRUE / FALSE

const HEADERS = {
  Participants: ["id"],
  Voters: ["id", "time"],
  Ballots: ["choices"],
  Settings: []
};

// Run this ONCE from the editor (select setup, press Run) and authorise.
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(name => {
    const s = ss.getSheetByName(name) || ss.insertSheet(name);
    if (HEADERS[name].length && s.getLastRow() === 0) s.appendRow(HEADERS[name]);
  });
  const st = ss.getSheetByName("Settings");
  if (st.getLastRow() === 0) st.appendRow(["open", true]);
  if (!PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD"))
    throw new Error("Set the ADMIN_PASSWORD script property first (Project Settings -> Script properties).");
}

function doGet() { return out({ ok: true, message: "Voting backend is running." }); }

function doPost(e) {
  let p;
  try { p = JSON.parse(e.postData.contents); } catch (err) { return out({ error: "bad request" }); }
  try {
    switch (p.action) {
      case "status": return out({ open: isOpen() });
      case "check":  return out(check(p.id));
      case "vote":   return out(vote(p.id, p.choices));
    }
    if (!adminOk(p.pw)) return out({ error: "unauthorised" });
    switch (p.action) {
      case "login":   return out({ ok: true });
      case "setOpen": setOpen(p.open); return out({ ok: true });
      case "list":    return out({ items: list(p.what) });
      case "add":     return out({ added: addIds(p.ids) });
      case "remove":  return out({ removed: removeIds(p.ids) });
    }
    return out({ error: "unknown action" });
  } catch (err) {
    return out({ error: String(err.message || err) });
  }
}

// ---------- helpers ----------
function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function sheet(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function adminOk(pw) {
  const real = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  return !!real && pw === real;
}
function norm(id) { return String(id || "").replace(/\s+/g, "").toUpperCase(); }
function column(name) {            // all values in column A below the header
  const s = sheet(name), n = s.getLastRow() - 1;
  return n > 0 ? s.getRange(2, 1, n, 1).getValues().map(r => String(r[0])) : [];
}
function isOpen() {
  const v = sheet("Settings").getRange("B1").getValue();
  return !(v === false || String(v).toUpperCase() === "FALSE");
}
function setOpen(open) { sheet("Settings").getRange("A1:B1").setValues([["open", !!open]]); }

// ---------- voter side ----------
function check(id) {
  id = norm(id);
  return { allowed: column("Participants").indexOf(id) !== -1, voted: column("Voters").indexOf(id) !== -1 };
}

function vote(id, choices) {
  id = norm(id);
  if (!choices || typeof choices !== "object") throw new Error("bad ballot");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);                       // one vote processed at a time
  try {
    if (!isOpen()) throw new Error("Voting is closed.");
    if (column("Participants").indexOf(id) === -1) throw new Error("This ID is not eligible to vote.");
    if (column("Voters").indexOf(id) !== -1) throw new Error("already voted");

    const clean = {};
    Object.keys(choices).forEach(k => { clean[String(k).slice(0, 40)] = String(choices[k]).slice(0, 200); });

    sheet("Voters").appendRow([id, new Date()]);
    // Insert the ballot at a random row so row order can't be matched to the Voters list.
    const b = sheet("Ballots"), n = b.getLastRow();      // n includes header
    const at = 2 + Math.floor(Math.random() * Math.max(n, 1));   // between row 2 and n+1
    if (at <= n) { b.insertRowBefore(at); b.getRange(at, 1).setValue(JSON.stringify(clean)); }
    else b.appendRow([JSON.stringify(clean)]);
    SpreadsheetApp.flush();
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// ---------- admin side ----------
function list(what) {
  if (what === "participants") return column("Participants");
  if (what === "voters") return column("Voters");
  if (what === "ballots") return column("Ballots").map(t => JSON.parse(t));
  throw new Error("unknown list");
}

function addIds(ids) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const have = new Set(column("Participants"));
    const fresh = [...new Set((ids || []).map(norm))].filter(x => x && !have.has(x));
    if (fresh.length) {
      const s = sheet("Participants");
      s.getRange(s.getLastRow() + 1, 1, fresh.length, 1).setNumberFormat("@").setValues(fresh.map(x => [x]));
    }
    return fresh.length;
  } finally { lock.releaseLock(); }
}

function removeIds(ids) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const drop = new Set((ids || []).map(norm));
    const keep = column("Participants").filter(x => !drop.has(x));
    const s = sheet("Participants"), removed = column("Participants").length - keep.length;
    if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 1).clearContent();
    if (keep.length) s.getRange(2, 1, keep.length, 1).setNumberFormat("@").setValues(keep.map(x => [x]));
    return removed;
  } finally { lock.releaseLock(); }
}
