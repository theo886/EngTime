Okay, AI coding assistant, let's refactor the EngTime application to implement client-side caching for improved navigation performance.

Goal: Modify the application to fetch all the user's timesheet data upon login, store it in a client-side cache, and use this cache for navigating between weeks. Submitting/updating a timesheet will update both the cache and the database via an API call.

Current State: The app fetches data from /api/GetTimeAllocations for each week navigated to.

Target State: Fetch data once from a new /api/GetAllTimeAllocations endpoint on login. Use a local JavaScript object (allTimesheetDataCache) to populate the UI during week navigation. /api/SaveTimeAllocation will be used for saving, which also updates the local cache.

Detailed Instructions:

Phase 1: Backend API Modifications (api/ folder)

[x] Action: Create a new HTTP-triggered Azure Function named GetAllTimeAllocations.
In your terminal, navigate to the api directory.
Run: func new --name GetAllTimeAllocations --template "HTTP trigger" --authlevel "anonymous"
[x] Action: Replace the contents of api/GetAllTimeAllocations/function.json with:
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": [
        "get" // Only allow GET requests
      ]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
content_copy
download
Use code with caution.
Json
[x] Action: Replace the contents of api/GetAllTimeAllocations/index.js with the following code to fetch all records for the logged-in user:
const sql = require('mssql');

// Helper function to get user info from header
function getUserInfo(req) {
    const header = req.headers['x-ms-client-principal'];
    if (!header) return null;
    const encoded = Buffer.from(header, 'base64');
    const decoded = encoded.toString('ascii');
    return JSON.parse(decoded);
}

module.exports = async function (context, req) {
    context.log('GetAllTimeAllocations function processing request.');

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
        // Fetch all records for the specific user
        // Ensure table/column names (UserId, Week, ProjectId, Percentage) match your DB
        const result = await pool.request()
                               .input('UserId', sql.NVarChar, userId)
                               .query('SELECT Week, ProjectId, Percentage FROM TimeAllocations WHERE UserId = @UserId ORDER BY Week, ProjectId'); // Order is good practice

        // Group results by week for easier frontend consumption
        const resultsByWeek = {};
        result.recordset.forEach(row => {
            const weekKey = row.Week; // Assuming 'Week' column stores the formatted week string directly
            if (!resultsByWeek[weekKey]) {
                resultsByWeek[weekKey] = [];
            }
            resultsByWeek[weekKey].push({
                // Only include necessary fields
                ProjectId: row.ProjectId,
                Percentage: row.Percentage
            });
        });

        context.res = {
            status: 200,
            // Send the data grouped by week
            body: resultsByWeek
        };

    } catch (err) {
        context.log.error("Database Query Error:", err);
        context.res = { status: 500, body: `Database error: ${err.message}` };
    } finally {
        if (pool) {
            try {
                await pool.close();
            } catch (closeErr) {
                context.log.error("Error closing connection:", closeErr);
            }
        }
    }
};
[x] Action: Verify the SQL query in `api/GetAllTimeAllocations/index.js` matches your actual `TimeAllocations` table structure and the `Week` column format.
content_copy
download
Use code with caution.
JavaScript
[x] Action: Verify the SQL query and table/column names in api/SaveTimeAllocation/index.js are correct. (No code changes needed here unless schema differs).
[x] Action: Delete the api/GetTimeAllocations/ directory entirely (including index.js and function.json).
Reason: This function is being replaced by GetAllTimeAllocations and client-side caching.
[x] Action: Delete the api/add-timesheet/ directory entirely.
Reason: This function appears unused/redundant given SaveTimeAllocation.
[x] Action: Delete the api/get-timesheets/ directory entirely.
Reason: This function appears unused/redundant given GetAllTimeAllocations.
Phase 2: Frontend State & Data Handling (index.js)

[x] Action: Locate the index.js file at the project root.
[x] Action: Add a new state variable near the top to act as the main data cache:
// State variables
let currentWeek = setInitialWeek();
let entries = [ // Represents the *currently displayed* week's entries
  { id: Date.now(), projectId: "", percentage: "100", isManuallySet: false }
];
let allTimesheetDataCache = {}; // <<< NEW: Cache for all user data { "weekString": [{ projectId, percentage }] }
let manuallyEditedIds = new Set();
// ... rest of state variables ...
let userInfo = null; // Store user info
content_copy
download
Use code with caution.
JavaScript
[x] Action: Remove the old previousSubmissions variable declaration. Find and delete:
let previousSubmissions = {};
content_copy
download
Use code with caution.
JavaScript
[x] Action: Remove or comment out the loading of fake data:
// Remove or comment out this block:
// if (debugMode) {
//   previousSubmissions = loadFakeDataForTesting(currentWeek, formatWeekRange);
// }
content_copy
download
Use code with caution.
JavaScript
[x] Action: Delete the loadFakeDataForTesting function call if it exists outside the debugMode block.
[x] Action: Delete the old loadData function entirely. Find and remove the whole function block:
// Delete this entire function:
// async function loadData(weekData) { ... }
content_copy
download
Use code with caution.
JavaScript
[x] Action: Add a new function loadAllDataIntoCache to fetch all data on login:
// --- NEW: Function to fetch all data ---
async function loadAllDataIntoCache() {
    if (!userInfo) {
        console.log("User not logged in. Cannot fetch all data.");
        allTimesheetDataCache = {}; // Ensure cache is empty
        return;
    }
    console.log("Fetching all time allocation data...");
    try {
        const response = await fetch(`/api/GetAllTimeAllocations`);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Error (${response.status}): ${errorBody || response.statusText}`);
        }
        allTimesheetDataCache = await response.json(); // Store the { "week": [...] } structure
        console.log(`Loaded ${Object.keys(allTimesheetDataCache).length} weeks into cache.`);
        // After loading all data, populate the view for the *current* week
        populateEntriesFromCache(formatWeekRange(currentWeek));

    } catch (err) {
        console.error("Error loading all timesheet data:", err);
        error = `Failed to load timesheet data: ${err.message}. Please refresh.`;
        allTimesheetDataCache = {}; // Clear cache on error
        resetEntriesToDefault(); // Reset view on error
        render(); // Show error message
    }
}
// --- END: New function ---
content_copy
download
Use code with caution.
JavaScript
[x] Action: Add a new function populateEntriesFromCache to update the entries state from the cache:
// --- NEW: Function to update UI from cache ---
function populateEntriesFromCache(weekKey) {
    console.log(`Populating entries from cache for week: ${weekKey}`);
    const cachedEntries = allTimesheetDataCache[weekKey];

    if (cachedEntries && cachedEntries.length > 0) {
        // Data exists in cache for this week
        entries = cachedEntries.map(entry => ({
            id: Date.now() + Math.random(), // Fresh UI ID
            projectId: entry.ProjectId,     // Match case from API/DB
            percentage: String(entry.Percentage), // Ensure string
            isManuallySet: false
        }));
        isSubmitted = true;
        isModified = false;
    } else {
        // No data in cache for this week, treat as new/empty
        resetEntriesToDefault(); // Use the existing reset function
        isSubmitted = false;
        isModified = false;
    }
    manuallyEditedIds = new Set(); // Always reset manual edits when navigating weeks
    entryInputModes = {}; // Reset input modes
    render(); // Render the UI with the populated/reset entries
}
// --- END: New function ---
content_copy
download
Use code with caution.
JavaScript
[x] Action: Modify the checkAuthStatus function (or the IIFE calling it at the bottom) to call loadAllDataIntoCache after successful authentication, instead of the old loadData:
async function checkAuthStatus() {
  try {
      const response = await fetch('/.auth/me');
      const mainContent = document.getElementById('main-content'); // Get main content div

      if (response.ok) {
          const payload = await response.json();
          currentUser = payload.clientPrincipal; // Use currentUser instead of userInfo
          if (currentUser) {
              isAuthenticated = true;
              updateAuthUI(); // Update login/logout UI
              initializeEventListeners(); // Initialize app event listeners
              await loadAllDataIntoCache(); // <<< CALL NEW FUNCTION HERE
              mainContent?.classList.remove('hidden'); // Show app content AFTER loading data
          } else {
              showLoginView();
              mainContent?.classList.add('hidden'); // Hide app content
          }
      } else {
          showLoginView();
          mainContent?.classList.add('hidden'); // Hide app content
      }
  } catch (error) {
      console.error("Error fetching auth status:", error);
      showLoginView(); // Show login on error
      document.getElementById('main-content')?.classList.add('hidden'); // Hide app content
  }
}

// Modify the IIFE or DOMContentLoaded handler:
document.addEventListener('DOMContentLoaded', function() {
    // State variables...
    // Access utility functions...

    // DOM elements
    const weeklyTrackerContainer = document.getElementById('weekly-tracker');
    if (weeklyTrackerContainer) {
       weeklyTrackerContainer.innerHTML = createInitialHTML();
    } else {
        console.error("Could not find #weekly-tracker container");
        return; // Stop if container isn't found
    }

    // Call checkAuthStatus (which now handles listeners and initial load)
    checkAuthStatus();

    // Global click listener for dropdowns remains the same
    document.addEventListener('click', function(event) {
         // ... (global click logic)
    });

    // Define rest of the functions (setInitialWeek, createInitialHTML, render, renderEntries, etc...)
    // ...
});
content_copy
download
Use code with caution.
JavaScript
(Note: The above snippet simplifies the initialization flow).
[x] Action: Modify goToPreviousWeek and goToNextWeek to use populateEntriesFromCache:
function goToPreviousWeek() {
    const prevWeekDate = new Date(currentWeek);
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    currentWeek = prevWeekDate;
    const weekKey = formatWeekRange(currentWeek);

    if (isPinned) {
        // Keep current entries, generate new IDs, reset modified/submitted state
         entries = entries.map(entry => {
             const newId = Date.now() + Math.random();
             return { ...entry, id: newId, isManuallySet: false };
         });
         manuallyEditedIds = new Set();
         entryInputModes = {};
         isSubmitted = false; // Treat pinned week as not submitted yet
         isModified = false;
         render(); // Render immediately with pinned data
    } else {
        // Use the cache
        populateEntriesFromCache(weekKey); // This handles render()
    }
}

function goToNextWeek() {
    const nextWeekDate = new Date(currentWeek);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    currentWeek = nextWeekDate;
    const weekKey = formatWeekRange(currentWeek);

    if (isPinned) {
         // Keep current entries, generate new IDs, reset modified/submitted state
         entries = entries.map(entry => {
             const newId = Date.now() + Math.random();
             return { ...entry, id: newId, isManuallySet: false };
         });
         manuallyEditedIds = new Set();
         entryInputModes = {};
         isSubmitted = false; // Treat pinned week as not submitted yet
         isModified = false;
         render(); // Render immediately with pinned data
    } else {
        // Use the cache
        populateEntriesFromCache(weekKey); // This handles render()
    }
}
content_copy
download
Use code with caution.
JavaScript
[x] Action: Modify the saveData function (or the submitTimesheet function if you renamed it) to update allTimesheetDataCache after a successful API call:
async function saveData(weekData, allocationEntries) { // Renamed from submitTimesheet for clarity
    if (!currentUser) { // Check currentUser state variable
        console.error("Cannot save data: user not logged in.");
        error = "You must be logged in to save data.";
        render();
        return;
    }

    // --- Validations (Keep these) ---
    const total = calculateTotal(allocationEntries.map(e => ({ percentage: String(e.percentage) }))); // Adapt validation if needed
    if (total !== 100) {
        error = "Total percentage must equal 100%";
        render();
        return;
    }
    if (allocationEntries.some(entry => !entry.projectId)) {
        error = "Please select a project for all entries";
        render();
        return;
    }
    const projectIds = allocationEntries.map(entry => entry.projectId);
    const uniqueProjectIds = new Set(projectIds);
    if (uniqueProjectIds.size !== projectIds.length) {
        error = "Duplicate projects are not allowed";
        render();
        return;
    }
    // --- End Validations ---


    const submitButton = document.getElementById('submit-button');
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
    error = ""; // Clear previous errors before saving

    try {
        const response = await fetch('/api/SaveTimeAllocation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ week: weekData, entries: allocationEntries }) // Send raw entries
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Error (${response.status}): ${errorBody || response.statusText}`);
        }

        const result = await response.json();
        console.log('Save successful:', result);

        // --- >>> UPDATE CACHE on success <<< ---
        allTimesheetDataCache[weekData] = allocationEntries.map(e => ({
            ProjectId: e.projectId, // Match cache structure (if different from API response)
            Percentage: e.percentage // Store as number if consistent
        }));
        // --- >>> END UPDATE CACHE <<< ---

        isModified = false; // Reset modification state
        isSubmitted = true; // Mark as submitted for the current view

    } catch (err) {
        console.error('Error saving data:', err);
        error = `Failed to save timesheet: ${err.message}`;
        // Do NOT change cache or flags on error
    } finally {
         render(); // Re-render to show confirmation/error/updated button state
    }
}
content_copy
download
Use code with caution.
JavaScript
[x] Action: Modify the initializeEventListeners function to call the correct saveData function when the submit button is clicked:
// Inside initializeEventListeners()
  document.getElementById('submit-button').addEventListener('click', () => {
      const weekStr = formatWeekRange(currentWeek);
      // Prepare entries in the format expected by the API/cache update
      const entriesToSave = entries
          .filter(e => e.projectId) // Only include entries with a selected project
          .map(e => ({
              projectId: e.projectId,
              percentage: parseInt(e.percentage || '0', 10) // Ensure it's an integer
          }));
      saveData(weekStr, entriesToSave); // Call the modified save function
  });
content_copy
download
Use code with caution.
JavaScript
[x] Action: Remove the sampleData.js script tag from index.html (root file):
<!-- Remove this line -->
<script src="sampleData.js"></script>
content_copy
download
Use code with caution.
Html
Phase 3: Cleanup & Testing

[x] Action: Review index.js for any remaining references to previousSubmissions and remove/replace them appropriately (e.g., in the processProjectData function for reports, which now needs adapting to use allTimesheetDataCache). Note: Report generation might need significant rework depending on how you want to display historical data.
[ ] Action: Test Locally (using swa start and func start as described previously).
Verify login works.
Verify all data loads initially (check network tab for /api/GetAllTimeAllocations call).
Verify week navigation (Prev/Next buttons) is fast and does not make new API calls.
Verify data populates correctly when navigating to weeks with/without existing data in the cache.
Verify submitting data calls /api/SaveTimeAllocation and updates the view correctly (shows "Submitted").
Verify navigating away and back to a submitted week shows the correct data from the cache.
[ ] Action: Commit all changes to Git.
[ ] Action: Push changes to trigger deployment.
[ ] Action: Test the deployed application thoroughly.
This detailed checklist provides the necessary steps for the AI assistant to implement the caching strategy. Remember to carefully adapt the SQL queries and data structures if your database schema differs from the examples.
