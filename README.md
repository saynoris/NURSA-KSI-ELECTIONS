# Student ID Voting System

Static site (HTML + JavaScript) for GitHub Pages.

- `index.html` – voting page for students
- `admin.html` – admin: upload participants, view results (sign-in required)
- `config.js` – title, positions, candidates, Firebase settings
- `store.js` – storage and ID logic

## Demo mode (no setup)

Open `index.html` / `admin.html` in a browser. Data stays in that browser only. Good for testing.

## Real voting (Firebase, free tier)

GitHub Pages cannot store votes, so use Firebase Firestore as the shared database.

1. Create a project at https://console.firebase.google.com
2. **Build -> Firestore Database** -> create a database.
3. **Build -> Authentication** -> Sign-in method -> enable **Email/Password** -> Users -> **Add user** (this is your admin login). Do not add other users.
4. Project settings -> add a **Web app**; copy `apiKey` and `projectId` into `config.js`:
   `firebase: { projectId: "...", apiKey: "..." }`
5. Firestore -> **Rules**, paste this (replace the email with your admin email), then Publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && request.auth.token.email == "ADMIN_EMAIL_HERE";
    }
    // Open unless the admin has switched the election off
    function electionOpen() {
      return !exists(/databases/$(database)/documents/settings/election)
        || get(/databases/$(database)/documents/settings/election).data.open == true;
    }
    match /settings/{doc} {
      allow get: if true;               // voters read open/closed
      allow write: if isAdmin();        // only you can open or close the election
    }
    match /participants/{id} {
      allow get: if true;               // lets the voting page check one ID
      allow list, write: if isAdmin();  // only you can see or change the list
    }
    match /voters/{id} {
      allow get: if true;
      allow create: if electionOpen() && exists(/databases/$(database)/documents/participants/$(id));
      allow list: if isAdmin();
      allow update, delete: if false;
    }
    match /ballots/{id} {
      allow create: if electionOpen();
      allow read: if isAdmin();
      allow update, delete: if false;
    }
  }
}
```

6. Push the files to GitHub -> Settings -> Pages -> deploy from `main`.
7. Open `/admin.html`, sign in, upload your participants, then share the main link.

## Admin page

- **Election status:** a button at the top opens or closes voting. Closed = voters see "Voting is closed" and the database rejects new votes. (Re-paste the rules above if you set up Firebase earlier.)
- **One vote per browser:** after someone votes, that browser shows "Voting is ongoing" with no ID box, so the same device cannot enter again. Clearing site data or using another browser gets past this, but the student ID can still only vote once.

- **Participants:** paste IDs or ranges (e.g. `224NSK1100001-224NSK1100130`), or upload a .csv/.txt (IDs in first column). Preview, Add, Remove, or Delete all.
- **Results:** counts per position, turnout, and CSV downloads (results, and who has not voted).

## Limits to know about

Front-end-only voting suits class/club polls, not high-stakes elections:

- Someone technical could use the public Firebase key to add extra ballots directly. Ballots are not linked to voters, so this cannot be fully prevented without a server (e.g. Cloud Functions).
- IDs are not secret, so anyone who knows or guesses a participant's ID could vote as them. Add a per-student PIN if that matters.
- The admin can see who has voted (turnout list) but not how they voted.
