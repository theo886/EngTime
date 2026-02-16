# EngTime - Engineering Timesheet Tracker

## Overview
Weekly percentage-based time tracking app. Vanilla JS frontend deployed as an Azure Static Web App
with Azure Functions (Node.js) backend and Azure Table Storage.

## Commands
- `npm start` — local dev server on port 8080
- `npm run build:css` — compile Tailwind CSS (required before build)
- `npm run build` — full production build into `build/`
- No test suite configured

## Architecture
```
/                        → Frontend (vanilla JS, no framework)
├── index.html           → Entry point, loads scripts via <script> tags
├── index.js             → Main app logic (~76KB monolith, all UI rendering + state)
├── utils.js             → Utility functions (validation, percentage redistribution)
├── data/projectData.js  → Project registry (frequently updated, has specific format)
├── src/input.css         → Tailwind source CSS
├── build/               → Production build output
/api                     → Azure Functions backend (separate package.json)
├── GetAllTimeAllocations/  → GET: fetches all user timesheets from Table Storage
├── SaveTimeAllocation/     → POST: saves timesheet, triggers Power Automate flow
├── host.json               → Azure Functions v2 config
```

## Key Patterns
- **No framework**: UI is rendered via DOM manipulation in `index.js`, not React/Vue/etc.
- **Global scope**: Modules expose to `window` (e.g., `window.projectData`, `window.utilsFunctions`)
- **Auth**: Azure SWA built-in auth via `x-ms-client-principal` header (base64 JSON)
- **Storage**: Azure Table Storage with PartitionKey=userId, RowKey=weekDate_projectId
- **Project data**: `data/projectData.js` defines projects with id, name, code, color fields

## Deployment
- CI/CD via GitHub Actions → Azure Static Web Apps (on push to `main`)
- Frontend: served from `/` (output: `build/`)
- API: Azure Functions from `/api`
- Secrets: `AZURE_STATIC_WEB_APPS_API_TOKEN_NICE_MUD_0761CC110` in GitHub

## Environment Variables (API)
- `AZURE_TABLE_STORAGE_CONNECTION_STRING` — Table Storage connection (falls back to Managed Identity)
- `POWER_AUTOMATE_SAVE_URL` — Optional: triggers Excel update via Power Automate on save

## Gotchas
- `index.js` is a large monolith — all UI/state logic is in one file
- CSS changes require running `npm run build:css` (Tailwind compilation)
- The `api/` directory has its own `package.json` and `node_modules`
- `data/projectData.js` is the most frequently changed file (project additions/updates)
- `staticwebapp.config.json` is nearly empty (`{"routes":[]}`) — routing is minimal
