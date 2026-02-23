// Weekly Percentage Tracker (Vanilla JavaScript)
document.addEventListener('DOMContentLoaded', function() {
  // Configuration flags
  const debugMode = true; // Set to false to disable fake data loading
  
  // Projects loaded from API (no static fallback)
  let projects = [];
  let defaultProjects = [];
  const loadFakeDataForTesting = window.loadFakeDataForTesting;
  
  // Access utility functions from global scope
  const { validateEntries, calculateTotal, redistributePercentages, formatWeekRange } = window.utilsFunctions;

  // State variables
  let currentWeek = setInitialWeek();
  const defaultEntryId = Date.now();
  let entries = [
    { id: defaultEntryId, projectId: "CP000039", percentage: "15", isManuallySet: true }
  ];
  let allTimesheetDataCache = {}; // Cache for all user data { "weekString": [{ projectId, percentage }] }
  let manuallyEditedIds = new Set([defaultEntryId]);
  let isAnyDropdownOpen = false;
  let isPinned = false;
  let error = "";
  let isSubmitted = false;
  let isModified = false;
  let entryInputModes = {}; // Will store entry.id -> 'percent' or 'hours'
  let userInfo = null; // Store user info
  let userDefaultInputMode = 'percent'; // User's preferred default input mode (percent or hours)
  let isAdmin = false; // Whether current user is an admin
  let timeSeriesChartInstance = null;
  let pieChartInstance = null;
  
  // // Load fake data for testing if in debug mode
  // if (debugMode) {
  //   previousSubmissions = loadFakeDataForTesting(currentWeek, formatWeekRange);
  // }

  // DOM elements
  const container = document.getElementById('weekly-tracker');
  if (container) {
      container.innerHTML = createInitialHTML();
      initializeEventListeners(); // Initialize listeners after creating HTML
      container.classList.add('hidden'); // Start hidden until auth check
  } else {
      console.error("Could not find #weekly-tracker container");
      return; // Stop if container isn't found
  }

  // Call checkAuthStatus (which now handles listeners and initial load)
  checkAuthStatus();

  // Add a global click event listener to close dropdowns when clicking outside
  document.addEventListener('click', function(event) {
    // --- Handle Project Dropdowns --- 
    // (Keep existing logic for project dropdowns, maybe refactor slightly)
    const clickedProjectDropdownTrigger = event.target.closest('.relative[data-id] > div:first-child'); // More specific trigger selector
    const clickedInsideProjectDropdown = event.target.closest('[data-dropdown]');
    const isClickInsideAnyProjectDropdown = clickedProjectDropdownTrigger || clickedInsideProjectDropdown;

    if (isAnyDropdownOpen && !isClickInsideAnyProjectDropdown) {
      // If a project dropdown is open and click is outside, close project dropdowns
      closeAllDropdowns(); // closeAllDropdowns should handle project dropdowns
    }
    // --- End Handle Project Dropdowns ---

    // --- Handle User Dropdown --- 
    const userDropdownButton = document.getElementById('user-dropdown-btn');
    const userDropdownContent = document.getElementById('user-dropdown-content');

    // Check if the user dropdown content exists and is currently shown
    if (userDropdownContent && userDropdownContent.classList.contains('show')) {
      // Check if the click was outside the button AND outside the dropdown content
      const isClickInsideUserDropdown = userDropdownButton?.contains(event.target) || userDropdownContent.contains(event.target);
      
      if (!isClickInsideUserDropdown) {
          console.log("Global click: Hiding user dropdown"); // DEBUG
          userDropdownContent.classList.remove('show');
      }
    }
    // --- End Handle User Dropdown ---
  });
  
  // Function to close all dropdowns
  function closeAllDropdowns() {
    const allDropdowns = document.querySelectorAll('[data-dropdown]');
    allDropdowns.forEach(dropdown => {
      dropdown.classList.add('hidden');
    });
    isAnyDropdownOpen = false;
    document.getElementById('add-project-button').disabled = false;
    //resetEntriesToDefault();
  }

  // --- Function to reset entries to configured default projects ---
  function resetEntriesToDefault() {
      manuallyEditedIds = new Set();
      entryInputModes = {};
      entries = defaultProjects.map((dp, index) => {
          const newId = Date.now() + index;
          manuallyEditedIds.add(newId);
          entryInputModes[newId] = userDefaultInputMode;
          return {
              id: newId,
              projectId: dp.id,
              percentage: dp.defaultPercentage.toString(),
              isManuallySet: true
          };
      });
      isSubmitted = false;
      isModified = false;
      error = "";
      console.log(`Entries reset to ${defaultProjects.length} configured default(s).`);
  }

  // Helper Functions
  function setInitialWeek() {
    const today = new Date();
    const day = today.getDay(); // 0 is Sunday
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  // Helper function to get the Monday of a given date's week
  function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 is Sunday
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0); // Reset time to start of day
    return monday;
  }

  // Find the first unfilled (unsubmitted) week starting from the earliest known data
  function findFirstUnfilledWeek() {
    const today = new Date();
    const startOfCurrentRealWeek = getStartOfWeek(today);

    // If no data at all, return current week
    if (Object.keys(allTimesheetDataCache).length === 0) {
      return startOfCurrentRealWeek;
    }

    // Walk backwards from current week to find earliest week with data (start boundary)
    let searchWeek = new Date(startOfCurrentRealWeek);
    let earliestWithData = null;
    // Search up to 52 weeks back
    for (let i = 0; i < 52; i++) {
      const weekKey = formatWeekRange(searchWeek);
      if (allTimesheetDataCache[weekKey]) {
        earliestWithData = new Date(searchWeek);
      }
      searchWeek.setDate(searchWeek.getDate() - 7);
    }

    // If no data found at all, return current week
    if (!earliestWithData) {
      return startOfCurrentRealWeek;
    }

    // Walk forward from earliest data week, find first gap
    let checkWeek = new Date(earliestWithData);
    while (checkWeek.getTime() <= startOfCurrentRealWeek.getTime()) {
      const weekKey = formatWeekRange(checkWeek);
      if (!allTimesheetDataCache[weekKey]) {
        // Found an unfilled week
        return new Date(checkWeek);
      }
      checkWeek.setDate(checkWeek.getDate() + 7);
    }

    // All weeks filled up to current week — return current week
    return startOfCurrentRealWeek;
  }

  // Get the top N most frequently used projects from the last 3 months of cache data
  function getFrequentProjects(topN = 5) {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const projectCounts = {};

    Object.keys(allTimesheetDataCache).forEach(weekKey => {
      // Parse the start date from "M/D/YYYY - M/D/YYYY"
      const startDateStr = weekKey.split(' - ')[0];
      const parts = startDateStr.split('/');
      if (parts.length !== 3) return;
      const [month, day, year] = parts.map(Number);
      const weekStartDate = new Date(year, month - 1, day);

      // Only count weeks within last 3 months
      if (weekStartDate < threeMonthsAgo) return;

      const weekEntries = allTimesheetDataCache[weekKey];
      if (!weekEntries) return;

      weekEntries.forEach(entry => {
        const pid = entry.ProjectId;
        if (!pid) return;
        projectCounts[pid] = (projectCounts[pid] || 0) + 1;
      });
    });

    // Sort by count descending, take top N
    const sorted = Object.entries(projectCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([pid]) => pid);

    // Return the actual project objects in frequency order
    return sorted
      .map(pid => projects.find(p => p.id.toString() === pid))
      .filter(Boolean);
  }

  function createInitialHTML() {
    return `
      <style>
        /* Remove arrows/spinners from number input */
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] {
          -moz-appearance: textfield; /* Firefox */
        }
        
        /* Style for unit toggle button */
        .unit-toggle-btn {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          background-color: #f1f5f9;
          border-left: 1px solid #e2e8f0;
          border-top-right-radius: 0.375rem;
          border-bottom-right-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.8rem;
          font-weight: 500;
          color: #64748b;
        }
        
        .unit-toggle-btn:hover {
          background-color: #e2e8f0;
          color: #334155;
        }
        
        /* With the button taking space, adjust input padding */
        .unit-input {
          padding-right: 28px !important;
        }
        
        /* Style for the user dropdown */
        .user-dropdown {
          position: relative;
          display: inline-block;
        }
        
        .user-dropdown-content {
          display: none;
          position: absolute;
          right: 0;
          background-color: white;
          min-width: 160px;
          box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
          z-index: 1;
          border-radius: 0.375rem;
          overflow: hidden;
        }
        
        .user-dropdown-content a {
          color: black;
          padding: 12px 16px;
          text-decoration: none;
          display: block;
          transition: background-color 0.2s;
        }
        
        .user-dropdown-content a:hover {
          background-color: #f1f5f9;
        }
        
        .user-dropdown-content.show {
          display: block;
        }
        
        /* NEW: Shimmer Animation */
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .shimmer-bg {
          animation: shimmer 2s infinite linear;
          background: linear-gradient(to right, transparent 0%, #e2e8f0 50%, transparent 100%);
          background-size: 1000px 100%; /* Adjust size as needed */
        }
        /* END: Shimmer Animation */
      </style>
      <div class="max-w-[650px] mx-auto p-4">
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
          <div class="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div class="flex justify-between items-center">
              <div>
                <h3 class="text-xl font-bold flex items-center text-indigo-800">
                  <svg class="h-5 w-5 mr-2 text-indigo-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  Engineering Timesheets
                </h3>
              </div>
              <!-- Authentication Section -->
              <div id="auth-section">
                <!-- Logged Out View -->
                <div id="login-view" class="hidden">
                  <button id="login-button" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                      Login
                  </button>
                </div>
                <!-- Logged In View (User Dropdown) -->
                <div id="user-view" class="user-dropdown hidden"> <!-- Initially hidden -->
                  <button id="user-dropdown-btn" class="flex items-center text-indigo-700 hover:text-indigo-900 focus:outline-none">
                    <span id="user-name" class="font-medium mr-1">User</span> <!-- Placeholder for name -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-1">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>
                  <div id="user-dropdown-content" class="user-dropdown-content">
                    <a href="#" id="dashboard-link" class="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                      </svg>
                      Dashboard
                    </a>
                    <a href="#" id="admin-link" class="flex items-center hidden">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      Admin
                    </a>
                    <a href="#" id="settings-link" class="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                        <line x1="4" y1="21" x2="4" y2="14"></line>
                        <line x1="4" y1="10" x2="4" y2="3"></line>
                        <line x1="12" y1="21" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12" y2="3"></line>
                        <line x1="20" y1="21" x2="20" y2="16"></line>
                        <line x1="20" y1="12" x2="20" y2="3"></line>
                        <line x1="1" y1="14" x2="7" y2="14"></line>
                        <line x1="9" y1="8" x2="15" y2="8"></line>
                        <line x1="17" y1="16" x2="23" y2="16"></line>
                      </svg>
                      Settings
                    </a>
                    <a href="#" id="logout-button" class="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                      Logout
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="p-6 relative">
            <!-- Loading Indicator Overlay -->
            <div id="loading-indicator" class="absolute inset-0 z-10 hidden bg-white/75">
              <div class="flex flex-col space-y-3 p-4">
                <!-- Single project dropdown skeleton -->
                <div class="flex items-center gap-3 min-w-0">
                  <div class="flex-1 min-w-0">
                    <div class="relative min-w-0 overflow-visible">
                      <div class="flex items-center justify-between px-3 py-2 border rounded-md bg-slate-100 relative overflow-hidden" style="height: 38px;">
                        <div class="shimmer-bg absolute inset-0"></div>
                      </div>
                    </div>
                  </div>
                  <div class="shrink-0">
                    <div class="relative w-[4.5rem] mx-auto">
                      <div class="w-full px-2 py-2 border rounded-md text-center bg-slate-100 relative overflow-hidden" style="height: 38px;">
                        <div class="shimmer-bg absolute inset-0"></div>
                      </div>
                    </div>
                  </div>
                  <div class="shrink-0 flex items-center justify-center">
                    <div class="h-8 w-8 bg-slate-100 rounded-md relative overflow-hidden">
                      <div class="shimmer-bg absolute inset-0"></div>
                    </div>
                  </div>
                </div>
                
                <!-- Add project button skeleton -->
                <div class="pt-2">
                  <div class="w-full border border-dashed border-indigo-300 py-2 rounded-md bg-slate-100 relative overflow-hidden" style="height: 38px;">
                    <div class="shimmer-bg absolute inset-0"></div>
                  </div>
                </div>
              </div>
            </div>
            <!-- END: Loading Indicator Overlay -->

            <div class="flex justify-center items-center gap-3 mb-3">
              <button id="prev-week-button" class="text-slate-600 hover:bg-slate-100 p-2 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </button>
              
              <div class="flex items-center">
                <button id="pin-button" class="mr-2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="17" x2="12" y2="22"></line>
                    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                  </svg>
                </button>
                <span id="week-display" class="text-lg font-semibold text-slate-800 text-center max-w-full break-words px-2"></span>
              </div>
              
              <button id="next-week-button" class="text-slate-600 hover:bg-slate-100 p-2 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </button>
            </div>
            
            <div id="error-container" class="mb-4 hidden"></div>
            
            <div id="entries-container" class="space-y-3"></div>
            
            <div class="pt-2">
              <button id="add-project-button" class="w-full border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 py-2 rounded-md">
                <div class="flex items-center justify-center">
                  <svg class="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Add Project
                </div>
              </button>
            </div>
            
            <div class="mt-6 pt-4 border-t flex flex-wrap justify-between items-center text-lg font-medium px-6">
              <div class="flex-1 min-w-0 hidden sm:block"></div>
              
              <div class="flex-1 flex justify-center mt-4 sm:mt-0 min-w-[120px]">
                <button id="submit-button" class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2 rounded">
                  Submit
                </button>
              </div>
              
              <div class="flex-1 flex justify-end items-center font-medium mt-4 sm:mt-0 min-w-[100px]">
                <span class="mr-2">Total:</span>
                <span id="total-percentage" class=""></span>
              </div>
            </div>
          </div>
          
          <div class="border-t p-4 pb-6 bg-slate-50 flex justify-center items-center h-8">
            <!-- Footer space -->
          </div>
        </div>
      </div>
    `;
  }

  function initializeEventListeners() {
    // --- Auth Buttons ---
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            window.location.href = '/.auth/login/aad'; // Redirect to Azure AD login
        });
    }
    
    // User dropdown toggle
    const userDropdownButton = document.getElementById('user-dropdown-btn');
    if (userDropdownButton) {
        userDropdownButton.addEventListener('click', (event) => {
             event.stopPropagation(); // Prevent global click listener from closing it immediately
             const content = document.getElementById('user-dropdown-content');
             if (content) {
                 const isCurrentlyShown = content.classList.contains('show');
                 if (isCurrentlyShown) {
                     // Hide it
                     content.classList.remove('show');
                 } else {
                     // Show it
                     content.classList.add('show');
                 }
             }
        });
    }
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async function(e) {
            e.preventDefault();
            await fetch('/.auth/logout');
            window.location.href = 'https://login.microsoftonline.com/common/oauth2/v2.0/logout';
        });
    }

    // --- Other Buttons ---
    document.getElementById('prev-week-button').addEventListener('click', goToPreviousWeek);
    document.getElementById('next-week-button').addEventListener('click', goToNextWeek);
    document.getElementById('add-project-button').addEventListener('click', addEntry);
    document.getElementById('submit-button').addEventListener('click', () => {
      const weekStr = formatWeekRange(currentWeek);
      // Prepare entries in the format expected by the API/cache update
      const entriesToSave = entries
          .filter(e => e.projectId) // Only include entries with a selected project
          .map(e => {
              // Find the project to get its name
              const project = projects.find(p => p.id.toString() === e.projectId);
              return {
                  projectId: e.projectId,
                  projectName: project ? project.name : 'Unknown Project', // Include project name
                  percentage: parseInt(e.percentage || '0', 10) // Ensure it's an integer
              };
          });
      saveData(weekStr, entriesToSave); // Call the modified save function
    });
    document.getElementById('pin-button').addEventListener('click', togglePin);

    // Add event listeners for dynamically added elements (using event delegation on the container)
    const entriesContainer = document.getElementById('entries-container');

    // Add event listener for repositioning open dropdowns on resize
    window.addEventListener('resize', () => {
      const openDropdown = document.querySelector('[data-dropdown]:not(.hidden)');
      if (openDropdown) {
        const id = openDropdown.dataset.dropdown;
        document.dispatchEvent(new CustomEvent('dropdown-toggled', { 
          detail: { id: id }
        }));
      }
    });

    // Dashboard link navigation
    const dashboardLink = document.getElementById('dashboard-link');
    if (dashboardLink) {
        dashboardLink.addEventListener('click', (event) => {
            event.preventDefault();
            showReportsPage();
            const dropdownContent = document.getElementById('user-dropdown-content');
            if (dropdownContent) {
                dropdownContent.classList.remove('show');
            }
        });
    }

    // Settings link
    const settingsLink = document.getElementById('settings-link');
    if (settingsLink) {
        settingsLink.addEventListener('click', (event) => {
            event.preventDefault();
            showSettingsModal();
            const dropdownContent = document.getElementById('user-dropdown-content');
            if (dropdownContent) {
                dropdownContent.classList.remove('show');
            }
        });
    }

    // Admin link
    const adminLink = document.getElementById('admin-link');
    if (adminLink) {
        adminLink.addEventListener('click', (event) => {
            event.preventDefault();
            showAdminPage();
            const dropdownContent = document.getElementById('user-dropdown-content');
            if (dropdownContent) {
                dropdownContent.classList.remove('show');
            }
        });
    }

    // Settings modal buttons
    const settingsCancelBtn = document.getElementById('settings-cancel-btn');
    if (settingsCancelBtn) {
        settingsCancelBtn.addEventListener('click', () => {
            document.getElementById('settings-modal').classList.add('hidden');
        });
    }
    const settingsSaveBtn = document.getElementById('settings-save-btn');
    if (settingsSaveBtn) {
        settingsSaveBtn.addEventListener('click', saveSettings);
    }
  }

  function render() {
    // Update week display
    document.getElementById('week-display').textContent = `Week of ${formatWeekRange(currentWeek)}`;
    
    // Update pin button
    const pinButton = document.getElementById('pin-button');
    pinButton.className = `mr-2 ${isPinned ? 'text-black' : 'text-slate-400'}`;
    
    // Update error display
    const errorContainer = document.getElementById('error-container');
    if (error && error !== "Please select a project for all entries" && error !== "Please enter percentage for all selected projects") {
      errorContainer.innerHTML = `
        <div class="p-3 rounded-md bg-red-50 text-red-800 border border-red-200">
          <div class="flex items-center">
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <div class="ml-2 text-sm">${error}</div>
          </div>
        </div>
      `;
      errorContainer.classList.remove('hidden');
    } else {
      errorContainer.classList.add('hidden');
    }
    
    // Render entries
    renderEntries();
    
    // Update total percentage
    const total = calculateTotalWrapper();
    const totalDisplay = document.getElementById('total-percentage');
    totalDisplay.textContent = `${total}%`;
    totalDisplay.className = total === 100 ? 'text-green-600' : 'text-red-600';
    
    // Update submit button
    updateSubmitButton();
    
    // Disable Add Project button if user is not logged in
    const addProjectButton = document.getElementById('add-project-button');
    if (addProjectButton) {
      if (!userInfo) {
        addProjectButton.disabled = true;
        addProjectButton.classList.add('opacity-60', 'cursor-not-allowed', 'hover:bg-white');
        addProjectButton.classList.remove('hover:bg-indigo-50');
      } else {
        addProjectButton.disabled = isAnyDropdownOpen;
        addProjectButton.classList.remove('opacity-60', 'cursor-not-allowed', 'hover:bg-white');
        if (!isAnyDropdownOpen) {
          addProjectButton.classList.add('hover:bg-indigo-50');
        }
      }
    }
    
    // Disable Submit button if user is not logged in
    const submitButton = document.getElementById('submit-button');
    if (submitButton && !userInfo) {
      submitButton.disabled = true;
      submitButton.classList.add('opacity-60', 'cursor-not-allowed');
      submitButton.classList.remove('hover:bg-indigo-700');
    }

    // --- Disable/Enable Next Week Button ---
    const nextWeekButton = document.getElementById('next-week-button');
    if (nextWeekButton) {
        const today = new Date();
        const startOfCurrentRealWeek = getStartOfWeek(today);
        // Allow navigating up to 2 weeks ahead of the current real week
        const maxWeek = new Date(startOfCurrentRealWeek);
        maxWeek.setDate(maxWeek.getDate() + 14);

        if (currentWeek.getTime() >= maxWeek.getTime()) {
            nextWeekButton.disabled = true;
            nextWeekButton.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            nextWeekButton.disabled = false;
            nextWeekButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
    // --- End Disable/Enable Next Week Button ---
  }

  function renderEntries() {
    const entriesContainer = document.getElementById('entries-container');
    entriesContainer.innerHTML = '';
    
    entries.forEach((entry, index) => {
      // Initialize input mode for new entries
      if (!entryInputModes[entry.id]) {
        entryInputModes[entry.id] = userDefaultInputMode;
      }
      
      const entryDiv = document.createElement('div');
      entryDiv.className = 'flex items-center gap-3 min-w-0';
      entryDiv.dataset.id = entry.id;
      
      // Project select column
      const selectDiv = document.createElement('div');
      selectDiv.className = 'flex-1 min-w-0';
      
      const selectContainer = document.createElement('div');
      selectContainer.className = 'relative min-w-0 overflow-visible';
      selectContainer.dataset.id = entry.id;
      
      const selectTrigger = document.createElement('div');
      selectTrigger.className = `flex items-center justify-between px-3 py-2 border rounded-md ${isDuplicateProject(entry.projectId) ? 'border-red-500' : ''}`;
      
      // Add cursor-pointer class and appropriate disabled styling based on login status
      if (userInfo) {
        selectTrigger.classList.add('cursor-pointer');
      } else {
        selectTrigger.classList.add('cursor-not-allowed', 'opacity-60');
      }
      
      // Find the selected project to display its color
      const selectedProject = entry.projectId ? projects.find(p => p.id.toString() === entry.projectId) : null;
      
      selectTrigger.innerHTML = `
        <div class="flex items-center space-x-2 overflow-hidden">
          ${selectedProject ? 
            `<span class="inline-block w-4 h-4 rounded-full flex-shrink-0" style="background-color: ${selectedProject.color || '#808080'}"></span>` : 
            ''}
          <span class="text-gray-500 truncate">
            ${selectedProject?.name || 'Select Project'}
          </span>
        </div>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="flex-shrink-0">
          <path d="M4.5 6.5L7.5 9.5L10.5 6.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      
      // Only add click event listener if user is logged in
      if (userInfo) {
        selectTrigger.addEventListener('click', function(event) {
          toggleDropdown(entry.id, event);
        });
      }
      
      selectContainer.appendChild(selectTrigger);
      
      // Create the dropdown (hidden by default)
      const dropdown = document.createElement('div');
      dropdown.className = 'fixed z-20 bg-white border border-gray-300 rounded-md shadow-lg hidden';
      dropdown.dataset.dropdown = entry.id;
      dropdown.style.maxHeight = '300px';
      dropdown.style.overflowY = 'auto';
      
      // Function to position the dropdown appropriately
      const positionDropdown = () => {
        const trigger = selectContainer.querySelector('div:first-child');
        const rect = trigger.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + window.scrollY}px`;
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.width = `${rect.width}px`; // Set width exactly the same as the trigger
      };
      
      // Add positioning logic to this dropdown
      dropdown.dataset.entryId = entry.id;
      document.addEventListener('dropdown-toggled', function(e) {
        if (e.detail.id === entry.id) {
          positionDropdown();
        }
      });
      
      // Helper to create a dropdown option for a project
      function createDropdownOption(project) {
        const option = document.createElement('div');
        option.className = 'px-3 py-2 hover:bg-slate-100 cursor-pointer overflow-hidden text-ellipsis flex items-center space-x-2';

        const colorDot = document.createElement('span');
        colorDot.className = 'inline-block w-4 h-4 rounded-full flex-shrink-0';
        colorDot.style.backgroundColor = project.color || '#808080';

        const label = document.createElement('span');
        label.className = 'truncate';
        label.textContent = `${project.name} (${project.id})`;

        option.appendChild(colorDot);
        option.appendChild(label);

        option.addEventListener('click', function(event) {
          updateEntry(entry.id, 'projectId', project.id.toString());
          dropdown.classList.add('hidden');
          isAnyDropdownOpen = false;
          document.getElementById('add-project-button').disabled = false;
          event.stopPropagation();
        });
        return option;
      }

      // Render "Frequently Used" section if there are frequent projects
      const frequentProjects = getFrequentProjects(5);
      if (frequentProjects.length > 0) {
        const freqHeader = document.createElement('div');
        freqHeader.className = 'px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider';
        freqHeader.textContent = 'Frequently Used';
        dropdown.appendChild(freqHeader);

        frequentProjects.forEach(project => {
          dropdown.appendChild(createDropdownOption(project));
        });

        // Separator
        const separator = document.createElement('div');
        separator.className = 'border-t border-slate-200 my-1';
        dropdown.appendChild(separator);

        const allHeader = document.createElement('div');
        allHeader.className = 'px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider';
        allHeader.textContent = 'All Projects';
        dropdown.appendChild(allHeader);
      }

      projects.forEach(project => {
        dropdown.appendChild(createDropdownOption(project));
      });
      
      selectContainer.appendChild(dropdown);
      selectDiv.appendChild(selectContainer);
      entryDiv.appendChild(selectDiv);
      
      // Percentage input column
      const percentageDiv = document.createElement('div');
      percentageDiv.className = 'shrink-0';
      
      const inputContainer = document.createElement('div');
      inputContainer.className = 'relative w-[4.5rem] mx-auto';
      
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      
      // Set max and placeholder based on input mode
      if (entryInputModes[entry.id] === 'percent') {
        input.max = '100';
        input.placeholder = '%';
        input.value = entry.percentage;
      } else {
        input.max = '40';
        input.placeholder = 'hr';
        // Convert percentage to hours (40 hours = 100%)
        input.value = Math.round((parseFloat(entry.percentage) / 100) * 40 * 10) / 10;
      }
      // Determine background color based on manual edit status
      const bgColorClass = manuallyEditedIds.has(entry.id) ? 'bg-white' : 'bg-slate-50';
      
      input.className = `w-full px-2 py-2 border rounded-md text-center unit-input ${bgColorClass}`;
      
      // Disable input if user not logged in
      if (!userInfo) {
        input.disabled = true;
        input.classList.add('opacity-60', 'cursor-not-allowed');
      }
      
      input.addEventListener('change', function(e) {
        const newValue = e.target.value;
        
        // If in hours mode, convert to percentage
        if (entryInputModes[entry.id] === 'hours') {
          // Convert hours to percentage (40 hours = 100%)
          const percentValue = Math.round((newValue / 40) * 100);
          updateEntry(entry.id, 'percentage', percentValue.toString());
          
          // Switch back to percentage mode
          entryInputModes[entry.id] = 'percent';
          render();
        } else {
          updateEntry(entry.id, 'percentage', newValue);
        }
      });
      
      const percentSymbol = document.createElement('span');
      percentSymbol.className = 'unit-toggle-btn';
      percentSymbol.textContent = entryInputModes[entry.id] === 'percent' ? '%' : 'hr';
      
      // Disable percentage toggle if user not logged in
      if (!userInfo) {
        percentSymbol.classList.add('opacity-60', 'cursor-not-allowed');
      } else {
        // Make the symbol clickable to toggle between percent and hours
        percentSymbol.addEventListener('click', function() {
          // Toggle the input mode
          entryInputModes[entry.id] = entryInputModes[entry.id] === 'percent' ? 'hours' : 'percent';
          
          // Re-render to update the UI
          render();
          
          // Focus the input after toggling
          setTimeout(() => {
            const inputs = document.querySelectorAll('input[type="number"]');
            inputs.forEach(input => {
              if (input.closest(`[data-id="${entry.id}"]`)) {
                input.focus();
                input.select();
              }
            });
          }, 50);
        });
      }
      
      inputContainer.appendChild(input);
      inputContainer.appendChild(percentSymbol);
      percentageDiv.appendChild(inputContainer);
      entryDiv.appendChild(percentageDiv);
      
      // Remove button column
      const removeDiv = document.createElement('div');
      removeDiv.className = 'shrink-0 flex items-center justify-center';
      
      if (entries.length > 1) {
        const removeButton = document.createElement('button');
        removeButton.className = 'h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md flex items-center justify-center flex-shrink-0';
        
        // Disable remove button if user is not logged in
        if (!userInfo) {
          removeButton.disabled = true;
          removeButton.classList.add('opacity-60', 'cursor-not-allowed');
          removeButton.classList.remove('hover:text-red-700', 'hover:bg-red-50');
        }
        
        removeButton.innerHTML = `
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        `;
        
        // Only add click event if user is logged in
        if (userInfo) {
          removeButton.addEventListener('click', function() {
            removeEntry(entry.id);
          });
        }
        
        removeDiv.appendChild(removeButton);
      }
      
      entryDiv.appendChild(removeDiv);
      entriesContainer.appendChild(entryDiv);
    });
  }

  function toggleDropdown(id, event) {
    const allDropdowns = document.querySelectorAll('[data-dropdown]');
    allDropdowns.forEach(dropdown => {
      if (dropdown.dataset.dropdown == id) {
        dropdown.classList.toggle('hidden');
        isAnyDropdownOpen = !dropdown.classList.contains('hidden');
        
        // Dispatch an event to position the dropdown
        if (!dropdown.classList.contains('hidden')) {
          document.dispatchEvent(new CustomEvent('dropdown-toggled', { 
            detail: { id: id }
          }));
        }
      } else {
        dropdown.classList.add('hidden');
      }
    });
    
    // Disable add button when dropdown is open
    document.getElementById('add-project-button').disabled = isAnyDropdownOpen;
    
    // Prevent the click from bubbling up to the document
    if (event) {
      event.stopPropagation();
    }
  }

  function togglePin() {
    isPinned = !isPinned;
    render();
  }

  // Helper function to format just the start date of a week
  function formatWeekStart(startDate) {
    return `${startDate.getMonth() + 1}/${startDate.getDate()}/${startDate.getFullYear()}`;
  }

  function getTimescaleCutoffDate(timescale) {
    const today = new Date();
    const cutoffDate = new Date(today);
    switch (timescale) {
      case '3mo':
        cutoffDate.setMonth(today.getMonth() - 3);
        break;
      case '6mo':
        cutoffDate.setMonth(today.getMonth() - 6);
        break;
      case '1yr':
        cutoffDate.setFullYear(today.getFullYear() - 1);
        break;
      case 'all':
        return null;
      default:
        cutoffDate.setMonth(today.getMonth() - 3);
    }
    return cutoffDate;
  }

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
    // loadData(formatWeekRange(currentWeek)); // REMOVE old loadData call
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
    // loadData(formatWeekRange(currentWeek)); // REMOVE old loadData call
  }

  function addEntry() {
    // If already submitted, mark as modified
    if (isSubmitted) {
      isModified = true;
    }
    
    // Get all manually edited entries
    const manualEntries = entries.filter(entry => manuallyEditedIds.has(entry.id));
    
    // Calculate the sum of manually set percentages
    const manualSum = manualEntries.reduce((sum, entry) => {
      return sum + (parseInt(entry.percentage) || 0);
    }, 0);
    
    // Calculate how many entries we'll have after adding a new one
    const newCount = entries.length + 1;
    
    // Calculate how many non-manual entries we'll have (including the new one)
    const nonManualCount = newCount - manualEntries.length;
    
    // Calculate the remaining percentage to distribute
    const remainingPercentage = Math.max(0, 100 - manualSum);
    
    // Calculate equal share for non-manual entries
    const equalShare = nonManualCount > 0 ? 
      Math.floor(remainingPercentage / nonManualCount) : 0;
    
    // Calculate the remainder after distributing equal shares
    const distributedTotal = equalShare * nonManualCount;
    const remainder = remainingPercentage - distributedTotal;
      
    // Create the new entry - if there's a remainder, add it to the new entry (which will be the last item)
    const newEntry = { 
      id: Date.now(), 
      projectId: "", 
      percentage: remainder > 0 ? (equalShare + remainder).toString() : equalShare.toString(), 
      isManuallySet: false 
    };
    
    // Set default input mode for the new entry
    entryInputModes[newEntry.id] = userDefaultInputMode;
    
    // Create updated entries list
    const updatedEntriesWithoutRemainder = entries.map(entry => {
      // Adjust percentages for non-manual entries
      if (!manuallyEditedIds.has(entry.id)) {
        return { ...entry, percentage: equalShare.toString() };
      }
      return entry;
    });
    
    // Just add the new entry without modifying existing entries further
    entries = [...updatedEntriesWithoutRemainder, newEntry];
    
    validateEntriesWrapper();
    render();
  }

  function removeEntry(id) {
    // If already submitted, mark as modified
    if (isSubmitted) {
      isModified = true;
    }
    
    if (entries.length > 1) {
      // Check if the entry being removed was manually set
      const isManuallySet = manuallyEditedIds.has(id);
      
      // Remove the entry
      const filteredEntries = entries.filter(entry => entry.id !== id);
      
      // If we're removing a manually set entry, update the manual IDs set
      if (isManuallySet) {
        manuallyEditedIds.delete(id);
      }
      
      // Clean up the input mode for the removed entry
      delete entryInputModes[id];
      
      // Get all manually edited entries after removal
      const manualEntries = filteredEntries.filter(entry => manuallyEditedIds.has(entry.id));
      
      // Calculate the sum of manually set percentages
      const manualSum = manualEntries.reduce((sum, entry) => {
        return sum + (parseInt(entry.percentage) || 0);
      }, 0);
      
      // Calculate how many non-manual entries we have
      const nonManualEntries = filteredEntries.filter(entry => !manuallyEditedIds.has(entry.id));
      
      // If we have non-manual entries, distribute the remaining percentage
      if (nonManualEntries.length > 0) {
        const remainingPercentage = Math.max(0, 100 - manualSum);
        
        if (nonManualEntries.length === 1) {
          // If only one non-manual entry, give it all the remaining percentage
          const nonManualEntryId = nonManualEntries[0].id;
          entries = filteredEntries.map(entry => {
            if (entry.id === nonManualEntryId) {
              return { ...entry, percentage: remainingPercentage.toString() };
            }
            return entry;
          });
        } else {
          // Calculate equal share and remainder
          const equalShare = remainingPercentage > 0 ? 
            Math.floor(remainingPercentage / nonManualEntries.length) : 0;
          
          const distributedTotal = equalShare * nonManualEntries.length;
          const remainder = remainingPercentage - distributedTotal;
          
          // First, set all non-manual entries to the equal share
          let updatedEntries = filteredEntries.map(entry => {
            if (!manuallyEditedIds.has(entry.id)) {
              return { ...entry, percentage: equalShare.toString() };
            }
            return entry;
          });
          
          // Then find the last non-manual entry in the visual list
          let lastVisualNonManualEntry = null;
          for (let i = updatedEntries.length - 1; i >= 0; i--) {
            if (!manuallyEditedIds.has(updatedEntries[i].id)) {
              lastVisualNonManualEntry = updatedEntries[i];
              break;
            }
          }
          
          // Add the remainder to the last visual non-manual entry
          if (lastVisualNonManualEntry && remainder > 0) {
            entries = updatedEntries.map(entry => {
              if (entry.id === lastVisualNonManualEntry.id) {
                return { ...entry, percentage: (parseInt(entry.percentage) + remainder).toString() };
              }
              return entry;
            });
          } else {
            entries = updatedEntries;
          }
        }
      } else {
        entries = filteredEntries;
      }
    }
    
    validateEntriesWrapper();
    render();
  }

  function updateEntry(id, field, value) {
    // If already submitted, mark as modified
    if (isSubmitted) {
      isModified = true;
    }
    
    const updatedEntries = entries.map(entry => {
      if (entry.id === id) {
        // If updating percentage, mark as manually set
        if (field === 'percentage') {
          manuallyEditedIds.add(id);
          return { ...entry, [field]: value, isManuallySet: true };
        }
        return { ...entry, [field]: value };
      }
      return entry;
    });
    
    entries = updatedEntries;
    
    // Only redistribute if percentage was updated
    if (field === 'percentage') {
      redistributePercentagesWrapper(id);
    }
    
    validateEntriesWrapper();
    render();
  }

  function redistributePercentagesWrapper(changedId) {
    // Call the utils version of redistributePercentages
    entries = redistributePercentages(entries, changedId, manuallyEditedIds);
    validateEntriesWrapper();
    render();
  }

  function calculateTotalWrapper() {
    return calculateTotal(entries);
  }

  function validateEntriesWrapper() {
    error = validateEntries(entries);
  }

  function isDuplicateProject(projectId) {
    return entries.filter(entry => entry.projectId === projectId).length > 1;
  }

  function submitTimesheet() {
    return false;
  }

  function updateSubmitButton() {
    const submitButton = document.getElementById('submit-button');
    
    // Get button props
    let buttonProps;
    if (isSubmitted) {
      if (isModified) {
        buttonProps = {
          text: "Update",
          className: "bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2 rounded"
        };
      } else {
        buttonProps = {
          text: "Submitted",
          className: "bg-slate-400 hover:bg-slate-500 text-white px-8 py-2 rounded cursor-default"
        };
      }
    } else {
      buttonProps = {
        text: "Submit",
        className: "bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2 rounded"
      };
    }
    
    // Check if button should be disabled
    const isDisabled = calculateTotalWrapper() !== 100 || 
           (!!error && error !== "Please select a project for all entries" && error !== "Please enter percentage for all selected projects") ||
           (isSubmitted && !isModified);
    
    // Update button
    submitButton.textContent = buttonProps.text;
    submitButton.className = buttonProps.className;
    submitButton.disabled = isDisabled;
    if (isDisabled) {
      submitButton.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }

  // Function to show the reports page
  function showReportsPage() {
    // Hide the timesheet view
    document.getElementById('weekly-tracker').classList.add('hidden');
    
    // Show the reports container
    const reportsContainer = document.getElementById('reports-container');
    reportsContainer.classList.remove('hidden');
    
    // Create reports page content
    createReportsPage();
  }

  // Function to create the reports page content
  function initializeTimescaleSelector() {
    const selector = document.getElementById('timescale-selector');
    if (!selector) {
      console.error('Timescale selector not found');
      return '3mo';
    }

    const savedTimescale = localStorage.getItem('reportsTimescale') || '3mo';
    selector.value = savedTimescale;

    selector.addEventListener('change', function() {
      localStorage.setItem('reportsTimescale', this.value);
      generateReports(this.value);
    });

    return savedTimescale;
  }

  function createReportsPage() {
    const reportsContainer = document.getElementById('reports-container');
    
    // Create the reports HTML
    reportsContainer.innerHTML = `
      <div class="max-w-[650px] mx-auto p-4">
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
          <div class="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div class="flex justify-between items-center">
              <h3 class="text-xl font-bold text-indigo-800">
                Dashboard
              </h3>
              <div class="flex space-x-3">
                <button id="back-to-timesheet" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                  Back to Timesheet
                </button>
              </div>
            </div>
            <div class="mt-4 flex justify-center items-center">
              <label class="mr-3 text-sm font-medium text-gray-700">Time Range:</label>
              <select id="timescale-selector" class="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm">
                <option value="3mo">Last 3 Months</option>
                <option value="6mo">Last 6 Months</option>
                <option value="1yr">Last Year</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
          
          <div class="p-6">
            <div id="no-data-message" class="hidden mb-6 p-4 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-md">
              <p class="font-medium">No submission data found</p>
              <p class="text-sm mt-1">Submit some timesheets to see real data in these reports. Currently showing projected/sample data.</p>
            </div>
            
            <div class="grid grid-cols-1 gap-6">
              <div class="bg-white p-4 rounded-lg shadow"> <!-- Donut chart container -->
                <div class="h-80">
                  <canvas id="pie-chart"></canvas>
                </div>
              </div>
              
              <div class="bg-white p-4 rounded-lg shadow"> <!-- Time series chart container -->
                <div class="h-96">
                  <canvas id="time-series-chart"></canvas>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add event listener for the back button
    document.getElementById('back-to-timesheet').addEventListener('click', function() {
      reportsContainer.classList.add('hidden');
      document.getElementById('weekly-tracker').classList.remove('hidden');
    });
    
    // Initialize timescale selector and get saved preference
    const initialTimescale = initializeTimescaleSelector();

    // Generate reports with the selected timescale
    generateReports(initialTimescale);
  }

  // Function to generate the report charts
  function generateReports(timescale = '3mo') {
    // Process data for the charts
    const projectData = processProjectData(timescale);

    const noDataMessage = document.getElementById('no-data-message');

    // Check if filtered data is empty but cache has data
    if (projectData.timeData.labels.length === 0 && Object.keys(allTimesheetDataCache).length > 0) {
      if (noDataMessage) {
        noDataMessage.textContent = '';
        const p1 = document.createElement('p');
        p1.className = 'font-medium';
        p1.textContent = 'No data available for selected time range';
        const p2 = document.createElement('p');
        p2.className = 'text-sm mt-1';
        p2.textContent = 'Try selecting a different time range or submit more timesheets.';
        noDataMessage.appendChild(p1);
        noDataMessage.appendChild(p2);
        noDataMessage.classList.remove('hidden');
      }
      return;
    }

    // Show warning if no data at all
    if (Object.keys(allTimesheetDataCache).length === 0) {
      if (noDataMessage) noDataMessage.classList.remove('hidden');
    } else {
      if (noDataMessage) noDataMessage.classList.add('hidden');
    }

    // Create the time series chart as a streamgraph
    createTimeSeriesChart(projectData.timeData);

    // Create the pie chart
    createPieChart(projectData.totalData, projectData.totalWeeks);
  }

  // Process project data for the charts
  function processProjectData(timescale = '3mo') {
    // Gather all submissions from the cache
    const submissionWeeks = Object.keys(allTimesheetDataCache); // <<< Use allTimesheetDataCache
    console.log("Found submission weeks from cache:", submissionWeeks);
    
    // Time series data structure
    const timeData = {
      labels: [],
      datasets: []
    };
    
    // Total distribution data
    const projectTotals = {};
    const weekTotals = {}; // To track average percentage per week
    let totalWeeks = 0;
    
    // Track when each project first appears for consistent ordering
    const projectFirstAppearance = {};
    
    // Helper function to convert week string to Date object for proper sorting
    const getWeekStartDate = (weekStr) => {
      // Extract the start date from format like "MM/DD/YYYY - MM/DD/YYYY"
      const startDateStr = weekStr.split(' - ')[0];
      // Handle potential variations in date format (e.g., single digit month/day)
      const parts = startDateStr.split('/');
      if (parts.length !== 3) {
          console.error(`Invalid date format in week string: ${weekStr}`);
          return new Date(); // Return current date as fallback
      }
      const [month, day, year] = parts.map(Number);
      return new Date(year, month - 1, day); // Note: months are 0-indexed in JS Date
    };

    // Filter weeks based on timescale
    const cutoffDate = getTimescaleCutoffDate(timescale);
    let filteredWeeks = submissionWeeks;
    if (cutoffDate !== null) {
      filteredWeeks = submissionWeeks.filter(week => {
        const weekStartDate = getWeekStartDate(week);
        return weekStartDate >= cutoffDate;
      });
    }

    // Check if we have actual submissions in the cache
    if (filteredWeeks.length > 0) {
      console.log("Using real submission data from cache for charts");
      totalWeeks = filteredWeeks.length;

      // Sort weeks chronologically by start date
      const sortedWeeks = [...filteredWeeks].sort((a, b) => {
        const dateA = getWeekStartDate(a);
        const dateB = getWeekStartDate(b);
        return dateA - dateB;
      });
      
      console.log("Chronologically sorted weeks from cache:", sortedWeeks);
      
      // First pass: track when each project first appears
      sortedWeeks.forEach((week, weekIndex) => {
        const weekEntries = allTimesheetDataCache[week]; // <<< Use allTimesheetDataCache
        if (!weekEntries) return; // Skip if cache entry is missing for some reason

        weekEntries.forEach(entry => {
          if (!entry.ProjectId) return; // <<< Check ProjectId (cache format)
          
          const projectName = projects.find(p => p.id.toString() === entry.ProjectId)?.name || 'Unknown'; // <<< Use ProjectId
          
          // Record the first week this project appears
          if (projectFirstAppearance[projectName] === undefined) {
            projectFirstAppearance[projectName] = weekIndex;
          }
        });
      });
      
      // Process each submitted week in chronological order
      sortedWeeks.forEach((week, weekIndex) => {
        const weekEntries = allTimesheetDataCache[week]; // <<< Use allTimesheetDataCache
        if (!weekEntries) return; // Skip if cache entry is missing

        // Get the start date from the week string and format it
        const weekStartDate = getWeekStartDate(week);
        timeData.labels.push(formatWeekStart(weekStartDate));
        
        // Process each entry in this week
        weekEntries.forEach(entry => {
          // Skip entries with no project
          if (!entry.ProjectId) return; // <<< Check ProjectId
          
          const projectName = projects.find(p => p.id.toString() === entry.ProjectId)?.name || 'Unknown'; // <<< Use ProjectId
          const percentage = parseInt(entry.Percentage) || 0; // <<< Use Percentage (cache format)
          
          // Add to project totals
          if (!projectTotals[projectName]) {
            projectTotals[projectName] = 0;
            weekTotals[projectName] = 0;
          }
          projectTotals[projectName] += percentage;
          weekTotals[projectName] += percentage;
          
          // Find or create dataset for this project
          let dataset = timeData.datasets.find(ds => ds.label === projectName);
          if (!dataset) {
            // Use project color from the projects array for consistency
            const projectObj = projects.find(p => p.id.toString() === entry.ProjectId); // <<< Use ProjectId
            const color = projectObj?.color || `hsl(${(parseInt(entry.ProjectId) * 137) % 360}, 70%, 60%)`; // <<< Use ProjectId
            
            dataset = {
              label: projectName,
              data: Array(timeData.labels.length - 1).fill(0), // Fill with zeros for previous weeks
              backgroundColor: color,
              borderColor: color,
              borderWidth: 2,
              tension: 0.3,
              // Store first appearance info for sorting
              firstAppearance: projectFirstAppearance[projectName] || 0
            };
            timeData.datasets.push(dataset);
          }
          
          // Add this week's percentage
          dataset.data.push(percentage);
        });
        
        // Ensure all datasets have data for this week (add zeros for projects not present this week)
        timeData.datasets.forEach(dataset => {
          if (dataset.data.length < timeData.labels.length) {
            dataset.data.push(0);
          }
        });
      });
      
      // Sort datasets by first appearance time (oldest projects first)
      timeData.datasets.sort((a, b) => a.firstAppearance - b.firstAppearance);
      
      // Calculate average percentage per week for each project
      Object.keys(weekTotals).forEach(project => {
        weekTotals[project] = Math.round(weekTotals[project] / totalWeeks);
      });
    } else {
      // <<< Logic for when cache is empty (no submissions) >>>
      console.log("Cache is empty, attempting to use current entry data or sample data for reports");
      
      // Check if we have current entries with projects selected
      const currentEntries = entries.filter(entry => entry.projectId);
      
      if (currentEntries.length > 0) {
          console.log("Using current unsaved entries for projected report.");
        // Use current week's data as a starting point
        const currentWeekFormatted = formatWeekStart(currentWeek);
        timeData.labels.push(currentWeekFormatted);
        
        // Add current entries to the chart
        currentEntries.forEach((entry, index) => {
          const projectName = projects.find(p => p.id.toString() === entry.projectId)?.name || 'Unknown';
          const percentage = parseInt(entry.percentage) || 0;
          
          // Add to project totals
          if (!projectTotals[projectName]) {
            projectTotals[projectName] = 0;
            // Don't track weekTotals here as it's not submitted data
          }
          projectTotals[projectName] += percentage;
          // weekTotals[projectName] += percentage; // Removed for projected data
          
          // Find or create dataset for this project
          let dataset = timeData.datasets.find(ds => ds.label === projectName);
          if (!dataset) {
            const projectObj = projects.find(p => p.id.toString() === entry.projectId);
            const color = projectObj?.color || `hsl(${(parseInt(entry.projectId) * 137) % 360}, 70%, 60%)`;
            
            dataset = {
              label: projectName,
              data: Array(timeData.labels.length - 1).fill(0),
              backgroundColor: color,
              borderColor: color,
              borderWidth: 2,
              tension: 0.3,
              firstAppearance: projectFirstAppearance[projectName] || 0, // Keep for consistency if needed
              orderIndex: index // Store order for sorting later if needed
            };
            timeData.datasets.push(dataset);
          }
          
          dataset.data.push(percentage);
        });
        
        // Generate labels for prev/next week for projection context
        const prevWeek = new Date(currentWeek);
        prevWeek.setDate(prevWeek.getDate() - 7);
        const prevWeekFormatted = formatWeekStart(prevWeek);
        
        const nextWeek = new Date(currentWeek);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekFormatted = formatWeekStart(nextWeek);
        
        timeData.labels = [prevWeekFormatted, currentWeekFormatted, nextWeekFormatted];
        
        // Update datasets for the 3-week projection
        timeData.datasets.forEach(dataset => {
          const currentValue = dataset.data[0]; // The only value we pushed earlier
          // Simple projection: assume similar distribution +- small random variation
          const prevVariation = Math.floor(Math.random() * 10) - 5;
          const prevValue = Math.max(0, Math.min(100, currentValue + prevVariation));
          const nextVariation = Math.floor(Math.random() * 10) - 5;
          const nextValue = Math.max(0, Math.min(100, currentValue + nextVariation));
          dataset.data = [prevValue, currentValue, nextValue];
          
          // Update project totals based on this 3-week projection for the pie chart
          projectTotals[dataset.label] = prevValue + currentValue + nextValue;
        });
        
        timeData.datasets.sort((a, b) => a.orderIndex - b.orderIndex); // Sort by original order
        totalWeeks = 3; // For pie chart averaging, consider the 3 projected weeks
        
      } else {
        // <<< Fallback to hardcoded sample data if cache and current entries are empty >>>
        console.log("Falling back to hardcoded sample data for reports.");
        const today = new Date();
        const week1 = new Date(today); week1.setDate(today.getDate() - 21);
        const week2 = new Date(today); week2.setDate(today.getDate() - 14);
        const week3 = new Date(today); week3.setDate(today.getDate() - 7);
        const week4 = new Date(today); // Current week
        timeData.labels = [formatWeekStart(week1), formatWeekStart(week2), formatWeekStart(week3), formatWeekStart(week4)];
        
        const sampleProjects = ['Website Redesign', 'Mobile App', 'Infrastructure'];
        sampleProjects.forEach((project, index) => {
          const hue = (index * 120) % 360;
          const color = `hsl(${hue}, 70%, 60%)`;
          const data = [ /* Sample data */ ]; // Keeping existing random generation
          data.push(Math.floor(Math.random() * 40) + 10);
          data.push(Math.floor(Math.random() * 40) + 10);
          data.push(Math.floor(Math.random() * 40) + 10);
          data.push(Math.floor(Math.random() * 40) + 10);

          timeData.datasets.push({
            label: project, data: data, backgroundColor: color, borderColor: color,
            borderWidth: 2, tension: 0.3, orderIndex: index
          });
          projectTotals[project] = data.reduce((sum, val) => sum + val, 0);
        });
        totalWeeks = 4; // Based on sample data
      }
    }
    
    // Prepare pie chart data
    const pieChartData = {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: []
      }]
    };
    
    if (Object.keys(allTimesheetDataCache).length > 0) { // <<< Use allTimesheetDataCache check
      // Use weekly averages for the pie chart when real data exists
      pieChartData.labels = Object.keys(weekTotals);
      pieChartData.datasets[0].data = Object.values(weekTotals);
    } else {
      // Use project totals / totalWeeks for projected/sample data
      pieChartData.labels = Object.keys(projectTotals);
      pieChartData.datasets[0].data = pieChartData.labels.map(label => Math.round(projectTotals[label] / (totalWeeks || 1)));
    }
    
    // Generate colors for the pie chart
    pieChartData.datasets[0].backgroundColor = pieChartData.labels.map((projectName, index) => {
      const projectObj = projects.find(p => p.name === projectName);
      return projectObj?.color || `hsl(${(index * 137) % 360}, 70%, 60%)`;
    });
    
    return { 
      timeData, 
      totalData: pieChartData, 
      totalWeeks: Object.keys(allTimesheetDataCache).length > 0 ? totalWeeks : 0 // Only return real totalWeeks
    };
  }

  // Create time series chart as a streamgraph
  function createTimeSeriesChart(data) {
    const ctx = document.getElementById('time-series-chart').getContext('2d');

    if (timeSeriesChartInstance) {
      timeSeriesChartInstance.destroy();
    }

    // Create a color gradient for each dataset to enhance the streamgraph effect
    const createGradient = (ctx, color) => {
      // Extract the HSL values
      const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (!match) return color;
      
      const [_, h, s, l] = match.map(Number);
      
      // Create a gradient from top to bottom
      const gradient = ctx.createLinearGradient(0, 0, 0, 500);
      gradient.addColorStop(0, `hsla(${h}, ${s}%, ${l+10}%, 0.85)`); // Lighter at top
      gradient.addColorStop(1, `hsla(${h}, ${s}%, ${l-5}%, 0.7)`);   // Darker at bottom
      return gradient;
    };
    
    // Prepare the datasets for a streamgraph by adding fill properties
    // Reverse the datasets array so the most recently added projects come from the bottom
    const streamData = {
      labels: data.labels,
      datasets: [...data.datasets].reverse().map(dataset => {
        const gradientColor = createGradient(ctx, dataset.backgroundColor);
        return {
          ...dataset,
          fill: true,                  // Enable filling under the line
          backgroundColor: gradientColor,
          borderColor: dataset.borderColor,
          borderWidth: 1,              // Thinner border
          pointRadius: 3,              // Slightly larger points for better visibility
          pointHoverRadius: 6,         // Larger on hover
          tension: 0.4,                // Smoother curves
        };
      })
    };

    timeSeriesChartInstance = new Chart(ctx, {
      type: 'line',
      data: streamData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            stacked: true,             // Enable stacking for streamgraph
            title: {
              display: true,
              text: 'Percentage (%)'
            },
            max: 100,
            grid: {
              color: 'rgba(200, 200, 200, 0.2)'  // Lighter grid lines
            }
          },
          x: {
            title: {
              display: true,
              text: 'Week of'
            },
            grid: {
              display: false           // Hide vertical grid lines for cleaner look
            }
          }
        },
        interaction: {
          mode: 'nearest',
          intersect: false,            // Show tooltip on hover anywhere near the data point
          axis: 'x'                    // Consider only the x axis when finding nearest
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,     // Use circles instead of rectangles in legend
              padding: 15,             // More padding between legend items
              // Reverse the legend order - REMOVED as we now sort alphabetically
              // reverse: true, 
              sort: (a, b) => a.text.localeCompare(b.text) // Sort legend alphabetically
            }
          },
          tooltip: {
            // --- ADDED: Specify events to prevent click persistence ---
            events: ['mousemove', 'mouseout', 'touchstart', 'touchmove'], 
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                const value = context.raw || 0;
                // --- ADDED: Check for 0 value ---
                if (Number(value) === 0) {
                    return null; // Return null to hide this line item completely
                }
                // --- End Add ---
                const label = context.dataset.label || '';
                // Convert percentage to hours
                const hours = (value / 100) * 40;
                return `${label}: ${value}% (${hours.toFixed(1)} hours)`;
              }
            },
            padding: 6,
            bodySpacing: 4,
            cornerRadius: 4,
            titleFont: { weight: 'bold', size: 13 }
          },
          title: {
            display: true,
            text: 'Project Time Distribution by Week',
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: {
              top: 10,
              bottom: 20
            }
          }
        }
      }
    });
  }

  // Create pie chart
  function createPieChart(data, totalWeeks) {
    const ctx = document.getElementById('pie-chart').getContext('2d');

    if (pieChartInstance) {
      pieChartInstance.destroy();
    }

    pieChartInstance = new Chart(ctx, {
      type: 'doughnut', // Changed from 'pie'
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '50%', // Reverted cutout to 50%
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true, // Add this line
              sort: (a, b) => a.text.localeCompare(b.text) // Sort legend alphabetically
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0; // This is the average weekly percentage
                
                // Calculate weekly hours based on percentage of a 40-hour week
                const weeklyHours = (value / 100) * 40;
                
                // For total hours, multiply by the number of weeks
                const numWeeks = totalWeeks || 1; // Use the passed totalWeeks
                const totalHours = weeklyHours * numWeeks;
                
                // Create the first line (Project: Percentage%)
                const line1 = `${label}: ${value}%`;
                
                // Create the second line based on number of weeks
                let line2 = '';
                if (totalWeeks > 1) {
                  line2 = `(${weeklyHours.toFixed(1)} hrs/week × ${numWeeks} weeks = ${totalHours.toFixed(1)} total hrs)`;
                } else {
                  line2 = `(${weeklyHours.toFixed(1)} hrs/week)`;
                }
                
                // Return as an array of strings for multi-line tooltip
                return [line1, line2];
              }
            }
          },
          title: {
            display: true,
            text: totalWeeks > 1 ? 'Average Weekly Time Distribution' : 'Weekly Time Distribution',
            font: {
              size: 16
            },
            padding: {
              bottom: 10
            }
          }
        }
      }
    });
  }

  // --- Settings Functions ---
  function showSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    // Pre-select the current setting
    const radios = modal.querySelectorAll('input[name="settings-input-mode"]');
    radios.forEach(radio => {
      radio.checked = (radio.value === userDefaultInputMode);
    });
    modal.classList.remove('hidden');
  }

  async function saveSettings() {
    const modal = document.getElementById('settings-modal');
    const selected = modal.querySelector('input[name="settings-input-mode"]:checked');
    if (!selected) return;

    const newMode = selected.value;
    const saveBtn = document.getElementById('settings-save-btn');
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
        await fetch('/api/SaveUserSettings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ defaultInputMode: newMode })
        });
        userDefaultInputMode = newMode;
        modal.classList.add('hidden');
    } catch (err) {
        console.error('Error saving settings:', err);
    } finally {
        saveBtn.textContent = 'Save';
        saveBtn.disabled = false;
    }
  }

  async function loadUserSettings() {
    try {
        const response = await fetch('/api/GetUserSettings');
        if (response.ok) {
            const settings = await response.json();
            userDefaultInputMode = settings.defaultInputMode || 'percent';
            console.log('Loaded user settings:', settings);
        }
    } catch (err) {
        console.error('Error loading user settings:', err);
    }
  }

  // Placeholder for admin page — implemented in Phase 3
  function showAdminPage() {
    if (!isAdmin) return;
    document.getElementById('weekly-tracker').classList.add('hidden');
    document.getElementById('reports-container').classList.add('hidden');
    const adminContainer = document.getElementById('admin-container');
    adminContainer.classList.remove('hidden');
    createAdminPage();
  }

  // Load projects from API (no fallback — errors surface immediately)
  async function loadProjectsFromAPI() {
    const response = await fetch('/api/GetProjects');
    if (!response.ok) {
        throw new Error(`Failed to load projects: ${response.status} ${response.statusText}`);
    }
    const apiProjects = await response.json();
    if (!apiProjects || apiProjects.length === 0) {
        throw new Error('No projects found. Run seedProjects.js or add projects via Admin page.');
    }
    projects = apiProjects;
    defaultProjects = apiProjects.filter(p => p.isActive && p.isDefault === true);
    console.log(`Loaded ${projects.length} projects from API (${defaultProjects.length} defaults).`);
  }

  // Check if current user is an admin
  async function checkAdminStatus() {
    try {
        const response = await fetch('/api/CheckAdmin');
        if (response.ok) {
            const data = await response.json();
            isAdmin = data.isAdmin === true;
            console.log('Admin status:', isAdmin);
        }
    } catch (err) {
        console.error('Error checking admin status:', err);
        isAdmin = false;
    }
  }

  // --- NEW: Authentication and Data Functions ---
  async function checkAuthStatus() {
    const weeklyTrackerContainer = document.getElementById('weekly-tracker'); // Get main content div
    const loadingIndicator = document.getElementById('loading-indicator');

    // --- Make container visible FIRST ---
    weeklyTrackerContainer?.classList.remove('hidden');

    try {
        // --- Show skeleton loader ---
        loadingIndicator?.classList.remove('hidden');

        // Use the existing function to get user info
        userInfo = await getUserInfoFromAuthEndpoint(); 
        console.log("User info from checkAuthStatus:", userInfo);

        if (userInfo) {
            // Domain restriction check
            if (!userInfo.userDetails || !userInfo.userDetails.toLowerCase().endsWith('@energyrecovery.com')) {
                loadingIndicator?.classList.add('hidden');
                weeklyTrackerContainer.textContent = '';

                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:2rem;';

                const heading = document.createElement('h2');
                heading.style.cssText = 'font-size:1.5rem;font-weight:600;margin-bottom:1rem;color:#991b1b;';
                heading.textContent = 'Access Restricted';

                const msg = document.createElement('p');
                msg.style.cssText = 'color:#4b5563;margin-bottom:1.5rem;';
                msg.textContent = 'This application is only available to @energyrecovery.com accounts.';

                const userMsg = document.createElement('p');
                userMsg.style.cssText = 'color:#6b7280;margin-bottom:2rem;';
                userMsg.textContent = 'You are signed in as ' + (userInfo.userDetails || 'unknown') + '.';

                const logoutLink = document.createElement('a');
                logoutLink.href = '/.auth/login/aad';
                logoutLink.style.cssText = 'padding:0.5rem 1.5rem;background:#2563eb;color:white;border-radius:0.375rem;text-decoration:none;font-weight:500;';
                logoutLink.textContent = 'Sign in with a different account';

                wrapper.appendChild(heading);
                wrapper.appendChild(msg);
                wrapper.appendChild(userMsg);
                wrapper.appendChild(logoutLink);
                weeklyTrackerContainer.appendChild(wrapper);
                return;
            }

            // Load user settings, check admin status, and load projects in parallel
            await Promise.all([loadUserSettings(), checkAdminStatus(), loadProjectsFromAPI()]);
            updateAuthUI(); // Update login/logout UI (handles showing user view)
            await loadAllDataIntoCache();
            // weeklyTrackerContainer?.classList.remove('hidden'); // REMOVED: Already visible
        } else {
            updateAuthUI(); // Update UI to show login view
            resetEntriesToDefault(); // Reset the view to default when logged out
            render(); // Re-render to show the cleared state
            // weeklyTrackerContainer?.classList.remove('hidden'); // REMOVED: Already visible
        }
    } catch (error) {
        console.error("Error checking auth status:", error);
        updateAuthUI(); // Show login on error
        resetEntriesToDefault(); // Reset the view on error too
        render(); // Re-render to show the cleared state
        // Ensure the container is visible on error too
        // weeklyTrackerContainer?.classList.remove('hidden'); // REMOVED: Already visible
    } finally {
        // --- Hide loader after everything ---
        loadingIndicator?.classList.add('hidden');
    }
  }

  async function getUserInfoFromAuthEndpoint() {
    try {
      const response = await fetch('/.auth/me');
      if (!response.ok) {
        // Not logged in or error
        console.log("User not logged in or /.auth/me failed.");
        return null;
      }
      const payload = await response.json();
      const principal = payload.clientPrincipal;
      // Extract display name from Entra ID claims if present
      if (principal && principal.claims && Array.isArray(principal.claims)) {
        const nameClaim = principal.claims.find(c => c.typ === 'name');
        if (nameClaim && nameClaim.val) {
          principal.displayName = nameClaim.val;
        }
      }
      return principal;
    } catch (error) {
      console.error('Error fetching user info:', error);
      return null;
    }
  }

  async function saveData(weekData, allocationEntries) {
    if (!userInfo) {
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
        // --- ADD: Extract user email ---
        const userEmail = userInfo?.userDetails || 'unknown@example.com'; // Use a fallback just in case
        
        const response = await fetch('/api/SaveTimeAllocation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // --- MODIFIED: Add userEmail and WeekStartDate to payload ---
            body: JSON.stringify({ 
                week: weekData, 
                userEmail: userEmail, // Added email
                WeekStartDate: formatWeekStart(currentWeek), // Added WeekStartDate
                entries: allocationEntries 
            })
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

  // --- NEW: Function to fetch all data ---
  async function loadAllDataIntoCache() {
    if (!userInfo) {
        console.log("User not logged in. Cannot fetch all data.");
        allTimesheetDataCache = {}; // Ensure cache is empty
        // --- Hide loader even if not logged in ---
        document.getElementById('loading-indicator')?.classList.add('hidden');
        return;
    }
    console.log("Fetching all time allocation data...");
    // --- Show loader just before fetch ---
    document.getElementById('loading-indicator')?.classList.remove('hidden');
    try {
        const response = await fetch(`/api/GetAllTimeAllocations`);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Error (${response.status}): ${errorBody || response.statusText}`);
        }
        allTimesheetDataCache = await response.json(); // Store the { "week": [...] } structure
        console.log(`Loaded ${Object.keys(allTimesheetDataCache).length} weeks into cache.`);
        // Find the first unfilled week and navigate to it
        currentWeek = findFirstUnfilledWeek();
        populateEntriesFromCache(formatWeekRange(currentWeek));

    } catch (err) {
        console.error("Error loading all timesheet data:", err);
        error = `Failed to load timesheet data: ${err.message}. Please refresh.`;
        allTimesheetDataCache = {}; // Clear cache on error
        resetEntriesToDefault(); // Reset view on error
        render(); // Show error message
    } finally {
        // --- Hide loader after fetch (success or error) ---
        document.getElementById('loading-indicator')?.classList.add('hidden');
    }
  }
  // --- END: New function ---

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
        manuallyEditedIds = new Set(); // Reset manual edits for cached weeks
        isSubmitted = true;
        isModified = false;
    } else {
        // No data in cache for this week, treat as new/empty
        resetEntriesToDefault(); // Sets manuallyEditedIds with default entry
        isSubmitted = false;
        isModified = false;
    }
    entryInputModes = {}; // Reset input modes
    render(); // Render the UI with the populated/reset entries
  }
  // --- END: New function ---

  // --- NEW: Update Auth UI ---
  function updateAuthUI() {
    const loginView = document.getElementById('login-view');
    const userView = document.getElementById('user-view');
    const userNameSpan = document.getElementById('user-name');

    if (!loginView || !userView || !userNameSpan) {
        console.error("Auth UI elements not found!");
        return;
    }

    if (userInfo) {
      // Logged in
      console.log("updateAuthUI: User is LOGGED IN"); // DEBUG
      loginView.classList.add('hidden');
      loginView.style.display = 'none'; // Keep for login view
      userView.classList.remove('hidden');
      // userView.style.display = ''; // REMOVE: Rely on CSS class
      
      // Prefer display name from Entra ID claims, fall back to email-derived format
      if (userInfo.displayName) {
        userNameSpan.textContent = userInfo.displayName;
      } else {
        // Get base username (before '@')
        let baseUsername = userInfo.userDetails || ''; // Fallback to email
        if (userInfo.userDetails) {
          baseUsername = userInfo.userDetails.includes('@') ? userInfo.userDetails.split('@')[0] : userInfo.userDetails;
        }

        // Format username: A.Theodossiou
        let formattedName = baseUsername; // Default to base username
        if (baseUsername && baseUsername.length >= 2) {
            // Capitalize first, add period, capitalize second, add rest
            formattedName = baseUsername[0].toUpperCase() + '.' + baseUsername[1].toUpperCase() + baseUsername.substring(2);
        } else if (baseUsername && baseUsername.length === 1) {
            // Handle single-character names: just capitalize
            formattedName = baseUsername[0].toUpperCase();
        }
        // If baseUsername is empty, formattedName remains empty

        userNameSpan.textContent = formattedName;
      }

      // Show/hide admin link based on admin status
      const adminLink = document.getElementById('admin-link');
      if (adminLink) {
        if (isAdmin) {
          adminLink.classList.remove('hidden');
          adminLink.style.display = '';
        } else {
          adminLink.classList.add('hidden');
          adminLink.style.display = 'none';
        }
      }

    } else {
      // Logged out
      console.log("updateAuthUI: User is LOGGED OUT"); // DEBUG
      if (loginView) {
          console.log("updateAuthUI: Showing login view"); // DEBUG
          loginView.classList.remove('hidden');
          loginView.style.display = ''; // Keep for login view
      } else {
          console.error("updateAuthUI: loginView not found!"); // DEBUG
      }
      if (userView) {
          console.log("updateAuthUI: Hiding user view"); // DEBUG
          userView.classList.add('hidden');
          userView.style.display = 'none'; // Re-add direct style manipulation
      } else {
          console.error("updateAuthUI: userView not found!"); // DEBUG
      }
      if (userNameSpan) { // Added check for safety
          userNameSpan.textContent = 'User'; // Reset placeholder
      } else {
          console.error("updateAuthUI: userNameSpan not found!"); // DEBUG
      }
      const adminLink = document.getElementById('admin-link');
      if (adminLink) {
        adminLink.classList.add('hidden');
        adminLink.style.display = 'none';
      }
    }
  }
  // --- END: Update Auth UI ---
});
