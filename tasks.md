Okay, shifting to a "load-all-on-login" cache strategy makes sense for improving navigation performance. This modifies the data flow significantly.

Here is the revised, extremely detailed checklist for the AI coding assistant, incorporating the caching mechanism:

Goal: Implement Entra ID login and Azure SQL database interaction, fetching all the user's timesheet data on login into a client-side cache to populate the weekly view, and only calling the save API on submission.

Phase 1: Project Structure & Build Setup

[DONE - Verify] Action: Folder my-functions at the root of the project is renamed to api.
[DONE - Verify] Action: No package.json or package-lock.json files exist inside the build/ directory.
[DONE - Verify] Action: File src/input.css exists at the project root with Tailwind directives.
[DONE - Verify] Action: The scripts section in the root package.json file uses the updated build scripts:
"scripts": {
  "start": "node server.js",
  "build:css": "tailwindcss -i ./src/input.css -o ./build/style.css --minify",
  "build": "npm run build:css && cp index.html build/ && cp index.js build/ && cp utils.js build/ && cp -r data build/style.css && echo 'Build completed successfully'",
  // ... other scripts ...
},
content_copy
download
Use code with caution.
Json
[DONE - Verify] Action: The root index.html file links the local style.css and does not include the Tailwind CDN script.
[DONE - Verify] Action: The .gitignore file includes api/local.settings.json.
Phase 2: Code Cleanup

[ ] Action: Delete the api/add-timesheet directory entirely.
[ ] Action: Delete the api/get-timesheets directory entirely.
[ ] Action: In the root package.json, ensure the "build" script does not copy sampleData.js or server.js. (Verified in Phase 1 check).
[ ] Action: Delete sampleData.js from the project root.
[ ] Action: Delete build/sampleData.js (if it exists).
[ ] Action: Delete server.js from the project root.
[ ] Action: Delete build/server.js (if it exists).
[ ] Action: In root index.html, remove the <script src="sampleData.js"></script> line.
[ ] Action: In root index.js:
Delete the debugMode constant.
Delete the loadFakeDataForTesting constant.
Delete the if (debugMode) { ... } block.
Delete the unused submitTimesheet function definition.
Phase 3: Backend API Modifications (api folder)

[ ] Action: Modify the api/GetTimeAllocations/function.json file to accept only GET requests (as it now fetches all data for the user, not specific weeks via POST/query).
Change: "methods": ["get", "post"]
To: "methods": ["get"]
[ ] Action: Modify the api/GetTimeAllocations/index.js function to fetch all timesheet data for the logged-in user, ignoring any week query parameter.
Replace the entire contents of api/GetTimeAllocations/index.js with:
const sql = require('mssql');

function getUserInfo(req) {
    const header = req.headers['x-ms-client-principal'];
    if (!header) return null;
    const encoded = Buffer.from(header, 'base64');
    const decoded = encoded.toString('ascii');
    return JSON.parse(decoded);
}

module.exports = async function (context, req) {
    context.log('GetTimeAllocations function processing request to fetch ALL user data.');

    const clientPrincipal = getUserInfo(req);

    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    const userId = clientPrincipal.userId;

    const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;
    if (!connectionString) {
        context.res = { status: 500, body: "Database connection string is not configured." };
        return;
    }

    let pool;
    try {
        pool = await sql.connect(connectionString);
        // Fetch ALL records for the user, ordering might be useful but not essential for cache
        // TODO: Replace TimeAllocations and column names if different
        const result = await pool.request()
                               .input('UserId', sql.NVarChar, userId)
                               .query('SELECT Week, ProjectId, Percentage FROM TimeAllocations WHERE UserId = @UserId');

        // Group results by week for easier consumption by the frontend cache
        const groupedData = {};
        result.recordset.forEach(row => {
            const weekKey = row.Week; // Assuming 'Week' column stores the "MM/DD/YYYY - MM/DD/YYYY" string
            if (!groupedData[weekKey]) {
                groupedData[weekKey] = [];
            }
            groupedData[weekKey].push({
                ProjectId: row.ProjectId,
                Percentage: row.Percentage // Keep as number from DB
            });
        });

        context.res = {
            status: 200,
            // Send the data grouped by week string
            body: groupedData
        };

    } catch (err) {
        context.log.error("Database Query Error:", err);
        context.res = { status: 500, body: `Database error: ${err.message}` };
    } finally {
        if (pool) {
             try { await pool.close(); context.log("SQL Connection closed."); }
             catch (closeErr) { context.log.error("Error closing SQL connection:", closeErr); }
        }
    }
};
content_copy
download
Use code with caution.
JavaScript
[ ] Action: Verify api/SaveTimeAllocation/index.js still correctly saves data for a specific user and week (it should delete existing entries for that specific user/week and insert the new ones). (No changes needed here based on previous instructions, just verify).
[ ] Action: Add TODO comments in api/GetTimeAllocations/index.js and api/SaveTimeAllocation/index.js to remind about replacing placeholder table/column names (TimeAllocations, UserId, Week, ProjectId, Percentage).
Phase 4: API Security (staticwebapp.config.json)

[DONE - Verify] Action: Ensure staticwebapp.config.json protects API routes and handles 401 redirects:
{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"]
    }
  ],
  "responseOverrides": {
    "401": {
      "redirect": "/.auth/login/aad",
      "statusCode": 302
    }
  }
}
content_copy
download
Use code with caution.
Json
Phase 5: Frontend Logic Changes (index.js)

[ ] Action: Modify the state variables section near the top of index.js:
Rename previousSubmissions to timesheetCache.
Initialize timesheetCache as an empty object {}.
// State variables
let currentWeek = setInitialWeek();
let entries = []; // Initialize empty, will be populated from cache/default
let manuallyEditedIds = new Set();
let isAnyDropdownOpen = false;
let isPinned = false;
let error = "";
let timesheetCache = {}; // <-- RENAMED and initialized empty
let isSubmitted = false;
let isModified = false;
let entryInputModes = {};
let userInfo = null;
let isLoading = true; // Add loading state
content_copy
download
Use code with caution.
JavaScript
[ ] Action: Add/Modify the loading indicator logic within render():
(Add) Near the top of render():
const mainContent = document.getElementById('main-content'); // Assuming you added this wrapper
 if (isLoading && mainContent) {
     // Optional: Add a more sophisticated loading indicator inside #main-content
     mainContent.innerHTML = '<p class="text-center p-10">Loading user data...</p>';
     mainContent.classList.remove('hidden'); // Show the loading message container
     return; // Don't render the rest while loading initial data
 } else if (mainContent && mainContent.firstChild?.tagName === 'P') {
     // Remove loading message if present and we're done loading
      container.innerHTML = createInitialHTML(); // Re-insert original structure
      initializeEventListeners(); // Re-attach listeners to the new DOM
 }
content_copy
download
Use code with caution.
JavaScript
Note: This simple loading state clears and redraws the main content. A more refined approach might use overlay spinners.
[ ] Action: Replace the loadData function with a new loadAllDataIntoCache function and a populateUIFromCacheOrDefaults function.
Delete: The existing loadData function.
Add: These two new functions:
async function loadAllDataIntoCache() {
    if (!userInfo) {
        console.log("User not logged in. Cannot fetch data.");
        isLoading = false; // Stop loading state
        timesheetCache = {}; // Ensure cache is empty
        populateUIFromCacheOrDefaults(formatWeekRange(currentWeek)); // Show default view
        return;
    }
    console.log("Fetching all timesheet data for user:", userInfo.userId);
    isLoading = true;
    error = ""; // Clear previous errors
    render(); // Show loading state

    try {
        const response = await fetch(`/api/GetTimeAllocations`); // No week parameter needed
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Error (${response.status}): ${errorBody}`);
        }
        const allData = await response.json();
        timesheetCache = allData || {}; // Store the fetched data (grouped by week)
        console.log("Timesheet cache populated:", Object.keys(timesheetCache).length, "weeks found.");

    } catch (err) {
        console.error('Error loading all data:', err);
        error = `Failed to load timesheet data: ${err.message}`;
        timesheetCache = {}; // Clear cache on error
    } finally {
        isLoading = false;
        // Now populate the UI for the current week from the (potentially updated) cache
        populateUIFromCacheOrDefaults(formatWeekRange(currentWeek));
         // Re-render is called by populateUIFromCacheOrDefaults
    }
}

function populateUIFromCacheOrDefaults(weekKey) {
     console.log("Populating UI for week:", weekKey);
     const cachedEntries = timesheetCache[weekKey];

     if (cachedEntries && cachedEntries.length > 0) {
         console.log("Using cached data.");
         entries = cachedEntries.map(entry => ({
             id: Date.now() + Math.random(), // Generate unique UI ID
             projectId: entry.ProjectId,
             percentage: entry.Percentage.toString(),
             isManuallySet: false
         }));
         isSubmitted = true; // Data exists for this week
     } else {
         console.log("Using default entries for week:", weekKey);
         resetEntriesToDefault(); // Use your reset function
         isSubmitted = false; // No submitted data for this week
     }
     manuallyEditedIds = new Set(); // Reset manual edits when changing week/loading
     isModified = false;        // Reset modification state
     error = "";                // Clear week-specific load errors
     entryInputModes = {};     // Reset input modes
     entries.forEach(e => { if(!entryInputModes[e.id]) entryInputModes[e.id] = 'percent' }); // Initialize modes
     render(); // Render the UI with the data for the current week
}
content_copy
download
Use code with caution.
JavaScript
[ ] Action: Modify the checkAuthStatus function to call loadAllDataIntoCache upon successful authentication.
async function checkAuthStatus() {
    isLoading = true; // Start in loading state
    render(); // Show initial loading message if needed
    try {
        const response = await fetch('/.auth/me');
        if (response.ok) {
            const payload = await response.json();
            currentUser = payload.clientPrincipal;
            if (currentUser) {
                isAuthenticated = true;
                userInfo = currentUser; // Set the global userInfo variable
                updateAuthUI();
                await loadAllDataIntoCache(); // <<< CALL CACHE LOAD HERE
            } else {
                showLoginView();
            }
        } else {
            showLoginView();
        }
    } catch (error) {
        console.error("Error fetching auth status:", error);
        showLoginView();
    } finally {
         if (!isAuthenticated) { // Ensure loading stops if auth fails
            isLoading = false;
            render();
         }
    }
  }
content_copy
download
Use code with caution.
JavaScript
[ ] Action: Modify goToPreviousWeek and goToNextWeek to use populateUIFromCacheOrDefaults instead of fetching data each time.
function goToPreviousWeek() {
    const prevWeek = new Date(currentWeek);
    prevWeek.setDate(prevWeek.getDate() - 7);
    currentWeek = prevWeek;
    const weekKey = formatWeekRange(currentWeek);

    if (isPinned) {
        // Keep current entries structure, generate new IDs etc.
        entries = entries.map(entry => ({ /* ... copy logic, ensure new IDs */ id: Date.now() + Math.random(), projectId: entry.projectId, percentage: entry.percentage, isManuallySet: false }));
        manuallyEditedIds = new Set();
        isSubmitted = timesheetCache[weekKey] && timesheetCache[weekKey].length > 0; // Check if target week HAS data in cache
        isModified = true; // Since we carried over potentially unsaved data
        render();
    } else {
        // Populate UI from cache or defaults for the new week
        populateUIFromCacheOrDefaults(weekKey);
    }
}

function goToNextWeek() {
    const nextWeek = new Date(currentWeek);
    nextWeek.setDate(nextWeek.getDate() + 7);
    currentWeek = nextWeek;
    const weekKey = formatWeekRange(currentWeek);

     if (isPinned) {
        // Keep current entries structure, generate new IDs etc.
         entries = entries.map(entry => ({ /* ... copy logic, ensure new IDs */ id: Date.now() + Math.random(), projectId: entry.projectId, percentage: entry.percentage, isManuallySet: false }));
         manuallyEditedIds = new Set();
         isSubmitted = timesheetCache[weekKey] && timesheetCache[weekKey].length > 0; // Check if target week HAS data in cache
         isModified = true; // Since we carried over potentially unsaved data
         render();
     } else {
         // Populate UI from cache or defaults for the new week
         populateUIFromCacheOrDefaults(weekKey);
    }
}
content_copy
download
Use code with caution.
JavaScript
[ ] Action: Modify the saveData function (called by the Submit button listener) to update the local timesheetCache upon successful API save.
async function saveData(weekData, allocationEntries) {
    // ... (userInfo check, disable button, clear error, render saving state) ...

    try {
        const response = await fetch('/api/SaveTimeAllocation', { /* ... */ });
        if (!response.ok) { /* ... throw error ... */ }
        const result = await response.json();
        console.log('Save successful:', result);

        // ---> UPDATE CACHE ON SUCCESS <---
        timesheetCache[weekData] = allocationEntries.map(e => ({
             ProjectId: e.projectId, // Match DB structure/casing if needed
             Percentage: e.percentage // Store as number maybe? Or keep as int like API expects? Consistentcy needed.
         }));
         console.log('Cache updated for week:', weekData);
        // ---> END CACHE UPDATE <---

        isModified = false;
        isSubmitted = true;

    } catch (err) {
        // ... (handle error, set error state) ...
    } finally {
         render(); // Re-render UI
    }
}
content_copy
download
Use code with caution.
JavaScript
[ ] Action: Ensure the initializeEventListeners function is called correctly after the initial checkAuthStatus completes and only if isAuthenticated is true. (Verified in previous checklist item).
[ ] Action: Ensure the Dashboard link (dashboard-link) listener in initializeEventListeners correctly calls showReportsPage. (Verified in previous checklist item).
Phase 6: Reporting Logic (index.js - processProjectData)

[ ] Action: Modify the processProjectData function to generate reports based on the timesheetCache instead of previousSubmissions.
Find: All instances of previousSubmissions within processProjectData.
Replace: Replace them with timesheetCache.
(Verify) The logic should now iterate over the keys (week strings) and entries within timesheetCache to build the report data. The overall structure of processProjectData should remain similar, just using the new cache variable.
Phase 7: Final Testing and Deployment

[ ] Action: Test Locally: Use swa start and func start. Verify login, initial data load (check network tab for one /api/GetTimeAllocations call), smooth week navigation (should not trigger API calls), saving data (should trigger /api/SaveTimeAllocation and update the view), and dashboard functionality.
[ ] Action: Commit all changes.
[ ] Action: Push changes to deploy.
[ ] Action: Test the live application thoroughly.
This revised approach loads all data upfront, making week-to-week navigation instant by reading from the JavaScript timesheetCache object. The trade-off is a potentially larger initial load time after login, depending on how much historical data the user has.
