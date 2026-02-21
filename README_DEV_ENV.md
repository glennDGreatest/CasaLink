# 3.0 Development Environment and Tools

## 3.1 Hardware Configuration

- Developer Workstations (typical):
  - OS: Windows 10/11 (developer's machine shown in repo metadata)
  - CPU: Quad-core Intel/AMD or better
  - RAM: 8–16 GB recommended
  - Storage: 256 GB SSD (development + local caches)
  - Browser: Google Chrome (latest stable) for development & debugging

- CI / Staging (recommended):
  - Small cloud VM (2 vCPU, 4–8 GB RAM) or managed hosting
  - Hosting: Firebase Hosting (static assets), no dedicated backend server required for this project

- Optional Local Services:
  - Firebase Local Emulator Suite (for Firestore/Auth testing)
  - A lightweight Linux VM or Docker container for reproducible builds (if adding Node-based tooling later)

## 3.2 Software Development Stack

| Category | Tool/Technology | Version (detected / recommended) | Purpose |
|----------|-----------------|----------------------------------:|---------|
| **Frontend** | Vanilla JavaScript (ES6+) | - | Client-side app logic (`js/`, `controllers/`, `services/`) |
| | HTML5 / CSS3 | - | Markup and styling (`views/`, `css/`) |
| | Font Awesome | 6.4.0 | UI icons (CDN reference in `index.html`) |
| | Google Fonts (Inter) | - | Typography (CDN) |
| **Charts & Reporting** | Chart.js | CDN (unspecified) | Visualizations (`js/chartsManager.js`, `js/predictionCharts.js`) |
| | html2pdf.js | 0.10.1 | Exporting reports to PDF (referenced in `index.html`) |
| **Backend / BaaS** | Firebase (Auth, Firestore, Functions, Storage) | 9.22.0 (compat) | Authentication, database, serverless functions, and file storage (`config/firebase.js`, `services/FirebaseService.js`) |
| **Email / Notifications** | EmailJS (@emailjs/browser) | 3.x | Sending transactional emails (`js/sendpulseService.js`) |
| **PWA / Offline** | Service Worker | Custom | Offline caching / app shell (`sw.js`) |
| | Web App Manifest | W3C spec | PWA installability (`manifest.json`) |
| **Storage / Persistence** | Firebase Storage | via Firebase SDK | File uploads (payment proofs) — referenced in `js/app.js` |
| | localStorage / sessionStorage | Web API | Persist UI state across pages and sessions |
| **Dev / Tooling** | Firebase CLI | recommended latest | Deploy to Firebase Hosting (`firebase.json`) |
| | Git | - | Source control and collaboration |
| | VS Code | - | Typical IDE (user environment) |
| | Browser devtools | - | Debugging and network inspection |

*Notes:* Many third-party libs are loaded via CDN (no `package.json` present). Where possible a specific SDK version is referenced in `index.html` and `config/firebase.js`.

## 3.3 Tool Selection Justification

- Firebase (Auth/Firestore/Storage): chosen to provide a fully managed backend (auth, real‑time/NoSQL DB, storage) so the project can remain serverless and reduce backend maintenance overhead.
- Vanilla JS + CDN-first libs: keeps the deploy simple (static hosting on Firebase Hosting), avoids bundler complexity for a small team, and enables rapid iteration in the browser.
- Chart.js & html2pdf.js: lightweight, well-documented libraries that meet the project needs for visualization and PDF export without heavy dependencies.
- EmailJS: quick way to send transactional emails from client-side code when server-side mail infrastructure is not available.
- Service Worker & Manifest: required to make the app installable as a PWA and provide offline-first user experience for tenants and landlords.

## 3.4 Development Workflow

- Local editing:
  - Edit files directly in the workspace (HTML/CSS/JS) in `views/`, `js/`, `controllers/`, `services/`.
  - Use VS Code and Chrome DevTools for debugging, live reload by refreshing the page.
- Local testing:
  - For Firebase-dependent features, use the Firebase Emulator Suite (recommended) to test Auth and Firestore locally.
  - Run the app via a simple local static server (or `firebase serve`) to test PWA and service worker behavior.
- Build & deploy:
  - Currently CDN-first; no build step required. For production deployments:
    1. Run `firebase deploy --only hosting` (requires Firebase CLI and project login).
    2. Confirm PWA resources (`sw.js`, `manifest.json`) are served at root scope.
- CI/CD (recommended):
  - Use GitHub Actions to run linting, optional tests, and `firebase deploy` on merges to `main`/`prod` branches.

## 3.5 Version Control and Collaboration

- Git workflow (recommended):
  - Branching: feature branches (`feature/xyz`) → pull requests → code review → merge to `main`.
  - Protect `main` with required reviews and CI checks before merging.
  - Use PR templates and issue templates to standardize contributions.
- Collaboration / Project Management:
  - Host the repo on GitHub or GitLab.
  - Use GitHub Issues (or equivalent) to track bugs and feature requests; use Milestones and Labels for release planning.
  - Use lightweight boards (GitHub Projects, Trello, or Jira) for sprint planning and backlog grooming.
- Commits & Code Quality:
  - Write descriptive commit messages and keep changes small and focused.
  - Consider adding linters (ESLint) and formatters (Prettier) if the project grows; these can be run in CI.

---

If you want, I can: 
- Commit `README_DEV_ENV.md` for you, or
- Add Firebase Emulator usage examples and `firebase.json` notes, or
- Generate a minimal `package.json` and ESLint config for local tooling. 
Which would you like next?