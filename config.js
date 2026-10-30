// ====== EDIT THIS FILE ======
window.VOTE_CONFIG = {
  title: "NURSA Executive Election 2026/2027",

  // Each candidate: name + photo path. Replace the sample files in /photos with real pictures
  // (keep the same file name, or change the path here, e.g. "photos/evans.jpg").
  // A President/VP ticket has two photos: photo: ["photos/a.jpg", "photos/b.jpg"]
  positions: [
    { id: "president", title: "President & Vice President", candidates: [
        { name: "Asare Frederick & Leah Hayford Freeman-Amoah", photo: ["photos/president-2-1.svg", "photos/president-2-2.jpg"] },
        { name: "Augustina Abena Boakyewaa & Emmanuella Foriwaa", photo: ["photos/president-1-1.jpg", "photos/president-1-2.jpg"] } ] },
    { id: "secretary", title: "Secretary", candidates: [
        { name: "Precious Opoku Ayei-wura", photo: "photos/secretary-1.jpg" } ] },
    { id: "orgsec", title: "Organizing Secretary", candidates: [
        { name: "Evans Opoku", photo: "photos/orgsec-1.jpg" } ] },
    { id: "pro", title: "Public Relations Officer", candidates: [
        { name: "Abigail Frimpomaa Kromah", photo: "photos/pro-1.jpg" } ] },
    { id: "finsec", title: "Financial Secretary", candidates: [
        { name: "Harriet Appah-Tah", photo: "photos/finsec-1.jpg" } ] },
    { id: "chaplain", title: "Chaplain", candidates: [
        { name: "Abigail Gyetey", photo: "photos/chaplain-1.jpg" } ] },
    { id: "sergeant", title: "Sergeant-at-Arms", candidates: [
        { name: "Agyemang Queena", photo: "photos/sergeant-1.jpg" } ] },
    { id: "senate", title: "Senate Representative", candidates: [
        { name: "Osly Osei Tutu", photo: "photos/senate-1.jpg" } ] },
    { id: "women", title: "Women's Commissioner", candidates: [
        { name: "Angelina Afriyie Appiah", photo: "photos/women-1.svg" },
        { name: "Grace Serwaa Mintah", photo: "photos/women-2.jpg" } ] },
    { id: "editor", title: "Editor", candidates: [
        { name: "Donnel Agyei", photo: "photos/editor-1.jpg" } ] },
    { id: "sports", title: "Sports Commissioner", candidates: [
        { name: "Gilbert Nyomahye", photo: "photos/sports-1.svg" } ] }
  ],

  // Optional: voting closes at this time (ISO string, e.g. "2026-11-05T18:00:00Z") or null.
  closesAt: null,

  // Shared database so every device is counted together and the admin page works.
  // Leave as null for DEMO mode (everything stays in this browser only).
  // Real use: { projectId: "my-project", apiKey: "AIza..." }  (see README.md)
  firebase: { projectId: "vvu-nursa-election-hub-ebc29", apiKey: "AIzaSyDkFlDTKD7DAHlfnGr8Fd4AjAmiB87-e4M" },

  // Demo mode only: IDs allowed when no participant list has been uploaded yet.
  // Write each range as TEXT in quotes, first ID - last ID. (Never type the numbers bare: a leading 0 breaks them.)
  // Format: prefix + number. Also shown pre-filled in the admin page for convenience.
  allowedRanges: [
    "224NSK1100001-224NSK1100300",
    "225NSK0100001-225NSK0100300",
    "226NSK0100001-226NSK0100150",
    "227NSK0100001-227NSK0100120",
    "226NSK0300001-226NSK0300100",
    "227NSK0400001-227NSK0400300"
    // Two ranges were left out until confirmed (they looked like typing mistakes):
    //   "225NSK0100001-225NSK1000200"  (end is 900,000 IDs away; if you meant 0100200 it is already covered above)
    //   "227NSK0300001-227NSK0100200"  (the end is lower than the start; maybe 227NSK0300200?)
  ]
};
