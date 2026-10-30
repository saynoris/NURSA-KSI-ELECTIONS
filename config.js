// ====== EDIT THIS FILE ======
window.VOTE_CONFIG = {
  title: "NURSA Executive Election 2026/2027",

  // Each candidate: name + photo path. Replace the sample files in /photos with real pictures
  // (keep the same file name, or change the path here, e.g. "photos/evans.jpg").
  // A President/VP ticket has two photos: photo: ["photos/a.jpg", "photos/b.jpg"]
  positions: [
    { id: "president", title: "President & Vice President", candidates: [
        { name: "Asare Frederick & Leah Hayford Freeman-Amoah", photo: ["president-2-1.svg", "president-2-2.jpg"] },
        { name: "Augustina Abena Boakyewaa & Emmanuella Foriwaa", photo: ["president-1-1.jpg", "president-1-2.jpg"] } ] },
    { id: "secretary", title: "Secretary", candidates: [
        { name: "Precious Opoku Ayei-wura", photo: "secretary-1.jpg" } ] },
    { id: "orgsec", title: "Organizing Secretary", candidates: [
        { name: "Evans Opoku", photo: "orgsec-1.jpg" } ] },
    { id: "pro", title: "Public Relations Officer", candidates: [
        { name: "Abigail Frimpomaa Kromah", photo: "pro-1.jpg" } ] },
    { id: "finsec", title: "Financial Secretary", candidates: [
        { name: "Harriet Appah-Tah", photo: "finsec-1.jpg" } ] },
    { id: "chaplain", title: "Chaplain", candidates: [
        { name: "Abigail Gyetey", photo: "chaplain-1.jpg" } ] },
    { id: "sergeant", title: "Sergeant-at-Arms", candidates: [
        { name: "Agyemang Queena", photo: "sergeant-1.jpg" } ] },
    { id: "senate", title: "Senate Representative", candidates: [
        { name: "Osly Osei Tutu", photo: "senate-1.jpg" } ] },
    { id: "women", title: "Women's Commissioner", candidates: [
        { name: "Angelina Afriyie Appiah", photo: "women-1.jpeg" },
        { name: "Grace Serwaa Mintah", photo: "women-2.jpg" } ] },
    { id: "editor", title: "Editor", candidates: [
        { name: "Donnel Agyei", photo: "editor-1.jpg" } ] },
    { id: "sports", title: "Sports Commissioner", candidates: [
        { name: "Gilbert Nyomahye", photo: "sports-1.jpeg" } ] }
  ],

  // Optional: voting closes at this time (ISO string, e.g. "2026-11-05T18:00:00Z") or null.
  closesAt: null,

  // Shared database so every device is counted together and the admin page works.
  // Leave as null for DEMO mode (everything stays in this browser only).
  // Real use: { projectId: "my-project", apiKey: "AIza..." }  (see README.md)
  firebase: null,

  // OR use Google Sheets as the database (see README, "Google Sheets mode").
  // Paste the Apps Script web app URL: { url: "https://script.google.com/macros/s/XXXX/exec" }
  // If both firebase and sheets are set, sheets is used.
  
  sheets: { url: "https://script.google.com/macros/s/AKfycbzanVpEokTmtbcYBZbEXwbEy22_P316mjD3qWdejn2_6u82w8TF6RmjsB6Yc_ViwBny/exec" },

  // Demo mode only: IDs allowed when no participant list has been uploaded yet.
  // Format: prefix + number. Also shown pre-filled in the admin page for convenience.
  allowedRanges: [
    { prefix: "224NSK", from: 1100001, to: 1100130 },
    { prefix: "225NSK", from: 100001,  to: 100099 },
    { prefix: "226NSK", from: 100001,  to: 100099 },
    { prefix: "226NSK", from: 300001,  to: 300130 },
    { prefix: "226NSK", from: 400001,  to: 400120 }
  ]
};
