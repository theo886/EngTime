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

[DONE] Action: Delete the api/add-timesheet directory entirely.
[DONE] Action: Delete the api/get-timesheets directory entirely.
[DONE] Action: In the root package.json, ensure the "build" script does not copy sampleData.js or server.js. (Verified in Phase 1 check).
[DONE] Action: Delete sampleData.js from the project root.
[DONE] Action: Delete build/sampleData.js (if it exists).
[DONE] Action: Delete server.js from the project root.
[DONE] Action: Delete build/server.js (if it exists).
[DONE] Action: In root index.html, remove the <script src="sampleData.js"></script> line.
[DONE] Action: In root index.js:
  [DONE] Delete the debugMode constant.
  [DONE] Delete the loadFakeDataForTesting constant.
  [DONE] Delete the if (debugMode) { ... } block.
  [DONE] Delete the unused submitTimesheet function definition.
Phase 3: Backend API Modifications (api folder)

[DONE] Action: Modify the api/GetTimeAllocations/function.json file to accept only GET requests (as it now fetches all data for the user, not specific weeks via POST/query).
[DONE] Action: Modify the api/GetTimeAllocations/index.js function to fetch all timesheet data for the logged-in user, ignoring any week query parameter.
[DONE] Action: Verify api/SaveTimeAllocation/index.js still correctly saves data for a specific user and week (it should delete existing entries for that specific user/week and insert the new ones). (Verified).
[DONE] Action: Add TODO comments in api/GetTimeAllocations/index.js and api/SaveTimeAllocation/index.js to remind about replacing placeholder table/column names (TimeAllocations, UserId, Week, ProjectId, Percentage).
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

[DONE] Action: Modify the state variables section near the top of index.js:
  [DONE] Rename previousSubmissions to timesheetCache.
  [DONE] Initialize timesheetCache as an empty object {}.
  [DONE] Add isLoading = true;
[DONE] Action: Add/Modify the loading indicator logic within render():
  [DONE] Add id="main-content" to the appropriate div in createInitialHTML.
  [DONE] Add loading logic at the start of render().
[DONE] Action: Replace the loadData function with a new loadAllDataIntoCache function and a populateUIFromCacheOrDefaults function.
  [DONE] Define resetEntriesToDefault globally.
  [DONE] Remove nested resetEntriesToDefault definition.
[DONE] Action: Modify the checkAuthStatus function (initializeApp) to call loadAllDataIntoCache upon successful authentication.
[DONE] Action: Modify goToPreviousWeek and goToNextWeek to use populateUIFromCacheOrDefaults instead of fetching data each time.
[DONE] Action: Modify the saveData function (called by the Submit button listener) to update the local timesheetCache upon successful API save.
[DONE] Action: Ensure the initializeEventListeners function is called correctly after the initial checkAuthStatus completes and only if isAuthenticated is true. (Verified).
[DONE] Action: Ensure the Dashboard link (dashboard-link) listener in initializeEventListeners correctly calls showReportsPage. (Verified).
Phase 6: Reporting Logic (index.js - processProjectData)

[DONE] Action: Modify the processProjectData function to generate reports based on the timesheetCache instead of previousSubmissions.
Phase 7: Final Testing and Deployment

[ ] Action: Test Locally: Use swa start and func start. Verify login, initial data load (check network tab for one /api/GetTimeAllocations call), smooth week navigation (should not trigger API calls), saving data (should trigger /api/SaveTimeAllocation and update the view), and dashboard functionality.
[ ] Action: Commit all changes.
[ ] Action: Push changes to deploy.
[ ] Action: Test the live application thoroughly.
This revised approach loads all data upfront, making week-to-week navigation instant by reading from the JavaScript timesheetCache object. The trade-off is a potentially larger initial load time after login, depending on how much historical data the user has.
