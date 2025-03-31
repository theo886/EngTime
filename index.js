// Weekly Percentage Tracker (Vanilla JavaScript)
document.addEventListener('DOMContentLoaded', function() {
  // Configuration flags
  const debugMode = true; // Set to false to disable fake data loading
  
  // Access projects and loadFakeDataForTesting from global scope
  const projects = window.projectData.projects;
  const loadFakeDataForTesting = window.loadFakeDataForTesting;
  
  // Access utility functions from global scope
  const { validateEntries, calculateTotal, redistributePercentages, formatWeekRange } = window.utilsFunctions;

  // State variables
  let currentWeek = setInitialWeek();
  let entries = [
    { id: Date.now(), projectId: "", percentage: "100", isManuallySet: false }
  ];
  let manuallyEditedIds = new Set();
  let isAnyDropdownOpen = false;
  let isPinned = false;
  let error = "";
  let previousSubmissions = {};
  let isSubmitted = false;
  let isModified = false;
  let entryInputModes = {}; // Will store entry.id -> 'percent' or 'hours'
  
  // Load fake data for testing if in debug mode
  if (debugMode) {
    previousSubmissions = loadFakeDataForTesting(currentWeek, formatWeekRange);
  }

  // DOM elements
  const container = document.getElementById('weekly-tracker') || document.body;
  container.innerHTML = createInitialHTML();
  
  // Initialize event listeners
  initializeEventListeners();
  
  // Render the initial state
  render();

  // Add a global click event listener to close dropdowns when clicking outside
  document.addEventListener('click', function(event) {
    // If no dropdown is open, do nothing
    if (!isAnyDropdownOpen) return;
    
    // Check if the click target is inside a dropdown or a select trigger
    const dropdownContainer = event.target.closest('[data-id]');
    
    // If clicked outside dropdowns, close all dropdowns
    if (!dropdownContainer) {
      closeAllDropdowns();
    }
  });
  
  // Function to close all dropdowns
  function closeAllDropdowns() {
    const allDropdowns = document.querySelectorAll('[data-dropdown]');
    allDropdowns.forEach(dropdown => {
      dropdown.classList.add('hidden');
    });
    isAnyDropdownOpen = false;
    document.getElementById('add-project-button').disabled = false;
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
      </style>
      <div class="max-w-[650px] mx-auto p-4">
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
          <div class="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div class="flex justify-between items-center">
              <div>
                <h3 class="text-xl font-bold flex items-center text-indigo-800">
                  <svg class="h-5 w-5 mr-2 text-indigo-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  Weekly Time Allocation
                </h3>
              </div>
              <div class="user-dropdown">
                <button id="user-dropdown-btn" class="flex items-center text-indigo-700 hover:text-indigo-900 focus:outline-none">
                  <span class="font-medium mr-1">Alex Theodossiou</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-1">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>
                <div id="user-dropdown-content" class="user-dropdown-content">
                  <a href="#" class="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                    Dashboard
                  </a>
                  <a href="#" class="flex items-center">
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
          
          <div class="p-6">
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
    // Pin button
    document.getElementById('pin-button').addEventListener('click', togglePin);
    
    // Week navigation
    document.getElementById('prev-week-button').addEventListener('click', goToPreviousWeek);
    document.getElementById('next-week-button').addEventListener('click', goToNextWeek);
    
    // Add project button
    document.getElementById('add-project-button').addEventListener('click', addEntry);
    
    // Submit button
    document.getElementById('submit-button').addEventListener('click', submitTimesheet);
    
    // User dropdown button
    const userDropdownBtn = document.getElementById('user-dropdown-btn');
    const userDropdownContent = document.getElementById('user-dropdown-content');
    
    if (userDropdownBtn && userDropdownContent) {
      // Toggle dropdown when clicking the button
      userDropdownBtn.addEventListener('click', function(event) {
        userDropdownContent.classList.toggle('show');
        event.stopPropagation();
      });
      
      // Close dropdown when clicking elsewhere on the page
      document.addEventListener('click', function(event) {
        if (!event.target.closest('.user-dropdown') && userDropdownContent.classList.contains('show')) {
          userDropdownContent.classList.remove('show');
        }
      });
      
      // Handle dropdown menu items
      userDropdownContent.querySelectorAll('a').forEach(item => {
        item.addEventListener('click', function(event) {
          event.preventDefault();
          const action = this.textContent.trim();
          
          if (action === 'Dashboard') {
            showReportsPage();
          } else {
            alert(`You clicked: ${action}`);
          }
          
          userDropdownContent.classList.remove('show');
        });
      });
    }

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
  }

  function renderEntries() {
    const entriesContainer = document.getElementById('entries-container');
    entriesContainer.innerHTML = '';
    
    entries.forEach((entry, index) => {
      // Initialize input mode for new entries
      if (!entryInputModes[entry.id]) {
        entryInputModes[entry.id] = 'percent';
      }
      
      const entryDiv = document.createElement('div');
      entryDiv.className = 'grid grid-cols-12 gap-x-2 sm:gap-x-3 items-center min-w-0';
      entryDiv.dataset.id = entry.id;
      
      // Project select column
      const selectDiv = document.createElement('div');
      selectDiv.className = 'col-span-7 md:col-span-9 min-w-0';
      
      const selectContainer = document.createElement('div');
      selectContainer.className = 'relative min-w-0 overflow-visible';
      selectContainer.dataset.id = entry.id;
      
      const selectTrigger = document.createElement('div');
      selectTrigger.className = `flex items-center justify-between px-3 py-2 border rounded-md cursor-pointer ${isDuplicateProject(entry.projectId) ? 'border-red-500' : ''}`;
      
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
      
      selectTrigger.addEventListener('click', function(event) {
        toggleDropdown(entry.id, event);
      });
      
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
      
      projects.forEach(project => {
        const option = document.createElement('div');
        option.className = 'px-3 py-2 hover:bg-slate-100 cursor-pointer overflow-hidden text-ellipsis flex items-center space-x-2';
        option.innerHTML = `
          <span class="inline-block w-4 h-4 rounded-full flex-shrink-0" style="background-color: ${project.color || '#808080'}"></span>
          <span class="truncate">${project.name} (${project.code})</span>
        `;
        option.addEventListener('click', function(event) {
          updateEntry(entry.id, 'projectId', project.id.toString());
          dropdown.classList.add('hidden');
          isAnyDropdownOpen = false;
          // Re-enable the add button
          document.getElementById('add-project-button').disabled = false;
          // Prevent the click from bubbling up to the document
          event.stopPropagation();
        });
        dropdown.appendChild(option);
      });
      
      selectContainer.appendChild(dropdown);
      selectDiv.appendChild(selectContainer);
      entryDiv.appendChild(selectDiv);
      
      // Percentage input column
      const percentageDiv = document.createElement('div');
      percentageDiv.className = 'col-span-3 sm:col-span-2 md:col-span-1';
      
      const inputContainer = document.createElement('div');
      inputContainer.className = 'relative w-16 mx-auto';
      
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
      
      input.className = 'w-full px-2 py-2 border rounded-md text-center unit-input';
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
      
      inputContainer.appendChild(input);
      inputContainer.appendChild(percentSymbol);
      percentageDiv.appendChild(inputContainer);
      entryDiv.appendChild(percentageDiv);
      
      // Remove button column
      const removeDiv = document.createElement('div');
      removeDiv.className = 'col-span-2 sm:col-span-2 md:col-span-2 flex items-center justify-center';
      
      if (entries.length > 1) {
        const removeButton = document.createElement('button');
        removeButton.className = 'h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md flex items-center justify-center flex-shrink-0';
        removeButton.innerHTML = `
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        `;
        removeButton.addEventListener('click', function() {
          removeEntry(entry.id);
        });
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

  function goToPreviousWeek() {
    const prevWeek = new Date(currentWeek);
    prevWeek.setDate(prevWeek.getDate() - 7);
    currentWeek = prevWeek;
    
    // Reset input modes
    entryInputModes = {};
    
    // If pinned, keep the current entries (matching the behavior of goToNextWeek)
    if (isPinned) {
      // Just clone the current entries with new IDs
      entries = entries.map(entry => {
        const newId = Date.now() + Math.random(); // Generate new IDs
        entryInputModes[newId] = 'percent'; // Set default input mode
        return {
          ...entry,
          id: newId
        };
      });
      isSubmitted = false;
      isModified = false;
    } else {
      // Check if we have stored entries for the previous week
      const prevWeekKey = formatWeekRange(prevWeek);
      const previousWeekEntries = previousSubmissions[prevWeekKey];
      
      // Check if the previous week was submitted
      isSubmitted = !!previousWeekEntries;
      isModified = false;
      
      // If we have previous entries for this week, use them
      if (previousWeekEntries && previousWeekEntries.length > 0) {
        entries = previousWeekEntries.map(entry => {
          const newId = Date.now() + Math.random(); // Generate new IDs
          entryInputModes[newId] = 'percent'; // Set default input mode
          return {
            ...entry,
            id: newId
          };
        });
      } else {
        // Otherwise start with a blank slate
        const newId = Date.now();
        entries = [{ id: newId, projectId: "", percentage: "100", isManuallySet: false }];
        entryInputModes[newId] = 'percent'; // Set default input mode
        manuallyEditedIds = new Set();
      }
    }
    
    render();
  }

  function goToNextWeek() {
    const nextWeek = new Date(currentWeek);
    nextWeek.setDate(nextWeek.getDate() + 7);
    currentWeek = nextWeek;
    
    // Reset input modes
    entryInputModes = {};
    
    // If pinned, keep the current entries
    if (isPinned) {
      // Just clone the current entries with new IDs
      entries = entries.map(entry => {
        const newId = Date.now() + Math.random(); // Generate new IDs
        entryInputModes[newId] = 'percent'; // Set default input mode
        return {
          ...entry,
          id: newId
        };
      });
      isSubmitted = false;
      isModified = false;
    } else {
      // Get the next week's entries if they exist
      const nextWeekKey = formatWeekRange(nextWeek);
      const previousWeekEntries = previousSubmissions[nextWeekKey];
      
      // Check if the next week was submitted
      isSubmitted = !!previousWeekEntries;
      isModified = false;
      
      // If we have previous entries for the next week, use them
      if (previousWeekEntries && previousWeekEntries.length > 0) {
        entries = previousWeekEntries.map(entry => {
          const newId = Date.now() + Math.random(); // Generate new IDs
          entryInputModes[newId] = 'percent'; // Set default input mode
          return {
            ...entry,
            id: newId
          };
        });
      } else {
        // Otherwise start with a blank slate
        const newId = Date.now();
        entries = [{ id: newId, projectId: "", percentage: "100", isManuallySet: false }];
        entryInputModes[newId] = 'percent'; // Set default input mode
        manuallyEditedIds = new Set();
      }
    }
    
    render();
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
    entryInputModes[newEntry.id] = 'percent';
    
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
    const total = calculateTotalWrapper();
    
    if (total !== 100) {
      error = "Total percentage must equal 100%";
      render();
      return;
    }
    
    if (entries.some(entry => !entry.projectId)) {
      error = "Please select a project for all entries";
      render();
      return;
    }
    
    // Check for duplicate projects
    const projectIds = entries.map(entry => entry.projectId);
    const uniqueProjectIds = new Set(projectIds);
    
    if (uniqueProjectIds.size !== projectIds.length) {
      error = "Duplicate projects are not allowed";
      render();
      return;
    }
    
    // In a real app, you would send this data to an API
    const timesheetData = {
      weekStarting: formatWeekRange(currentWeek),
      entries: entries.map(entry => ({
        projectId: entry.projectId,
        projectName: projects.find(p => p.id.toString() === entry.projectId)?.name,
        percentage: entry.percentage
      })),
      total: total
    };
    
    console.log("Submitting timesheet:", timesheetData);
    
    // Store this week's entries for future reference
    const weekKey = formatWeekRange(currentWeek);
    previousSubmissions[weekKey] = [...entries];
    
    // Update submission state
    isSubmitted = true;
    isModified = false;
    
    render();
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
          </div>
          
          <div class="p-6">
            <div id="no-data-message" class="hidden mb-6 p-4 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-md">
              <p class="font-medium">No submission data found</p>
              <p class="text-sm mt-1">Submit some timesheets to see real data in these reports. Currently showing projected/sample data.</p>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="bg-white p-4 rounded-lg shadow">
                <div class="h-96">
                  <canvas id="time-series-chart"></canvas>
                </div>
              </div>
              
              <div class="bg-white p-4 rounded-lg shadow">
                <div class="h-80">
                  <canvas id="pie-chart"></canvas>
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
    
    // Generate the reports data
    generateReports();
  }

  // Function to generate the report charts
  function generateReports() {
    // Process data for the charts
    const projectData = processProjectData();
    
    // Show warning if using sample data
    const noDataMessage = document.getElementById('no-data-message');
    if (Object.keys(previousSubmissions).length === 0) {
      noDataMessage.classList.remove('hidden');
    } else {
      noDataMessage.classList.add('hidden');
    }
    
    // Create the time series chart as a streamgraph
    createTimeSeriesChart(projectData.timeData);
    
    // Create the pie chart
    createPieChart(projectData.totalData, projectData.totalWeeks);
  }

  // Process project data for the charts
  function processProjectData() {
    // Gather all submissions
    const submissionWeeks = Object.keys(previousSubmissions);
    console.log("Found submission weeks:", submissionWeeks);
    
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
      // Extract the start date from format like "3/10/2025 - 3/16/2025"
      const startDateStr = weekStr.split(' - ')[0];
      const [month, day, year] = startDateStr.split('/').map(Number);
      return new Date(year, month - 1, day); // Note: months are 0-indexed in JS Date
    };
    
    // Check if we have actual submissions
    if (submissionWeeks.length > 0) {
      console.log("Using real submission data for charts");
      totalWeeks = submissionWeeks.length;
      
      // Sort weeks chronologically by start date
      const sortedWeeks = [...submissionWeeks].sort((a, b) => {
        const dateA = getWeekStartDate(a);
        const dateB = getWeekStartDate(b);
        return dateA - dateB;
      });
      
      console.log("Chronologically sorted weeks:", sortedWeeks);
      
      // First pass: track when each project first appears
      sortedWeeks.forEach((week, weekIndex) => {
        const weekEntries = previousSubmissions[week];
        
        weekEntries.forEach(entry => {
          if (!entry.projectId) return;
          
          const projectName = projects.find(p => p.id.toString() === entry.projectId)?.name || 'Unknown';
          
          // Record the first week this project appears
          if (projectFirstAppearance[projectName] === undefined) {
            projectFirstAppearance[projectName] = weekIndex;
          }
        });
      });
      
      // Process each submitted week in chronological order
      sortedWeeks.forEach((week, weekIndex) => {
        const weekEntries = previousSubmissions[week];
        // Get the start date from the week string and format it
        const weekStartDate = getWeekStartDate(week);
        timeData.labels.push(formatWeekStart(weekStartDate));
        
        // Process each entry in this week
        weekEntries.forEach(entry => {
          // Skip entries with no project
          if (!entry.projectId) return;
          
          const projectName = projects.find(p => p.id.toString() === entry.projectId)?.name || 'Unknown';
          const percentage = parseInt(entry.percentage) || 0;
          
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
            const projectObj = projects.find(p => p.id.toString() === entry.projectId);
            const color = projectObj?.color || `hsl(${(parseInt(entry.projectId) * 137) % 360}, 70%, 60%)`;
            
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
      console.log("No submissions found, using current entry data or sample data");
      
      // Check if we have current entries with projects selected
      const currentEntries = entries.filter(entry => entry.projectId);
      
      if (currentEntries.length > 0) {
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
            weekTotals[projectName] = 0;
          }
          projectTotals[projectName] += percentage;
          weekTotals[projectName] += percentage;
          
          // Find or create dataset for this project
          let dataset = timeData.datasets.find(ds => ds.label === projectName);
          if (!dataset) {
            // Use project color from the projects array for consistency
            const projectObj = projects.find(p => p.id.toString() === entry.projectId);
            const color = projectObj?.color || `hsl(${(parseInt(entry.projectId) * 137) % 360}, 70%, 60%)`;
            
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
        
        // Create array of weeks in chronological order
        const prevWeek = new Date(currentWeek);
        prevWeek.setDate(prevWeek.getDate() - 7);
        const prevWeekFormatted = formatWeekStart(prevWeek);
        
        const nextWeek = new Date(currentWeek);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekFormatted = formatWeekStart(nextWeek);
        
        // Clear current labels and use the ordered array
        timeData.labels = [prevWeekFormatted, currentWeekFormatted, nextWeekFormatted];
        
        // Update the datasets to match the ordered labels
        timeData.datasets.forEach(dataset => {
          // Current value is already set for currentWeekFormatted (index 1)
          const currentValue = dataset.data[0];
          
          // Generate values for other weeks
          const prevVariation = Math.floor(Math.random() * 10) - 5; // -5 to +5 variation
          const prevValue = Math.max(0, Math.min(100, currentValue + prevVariation));
          
          const nextVariation = Math.floor(Math.random() * 10) - 5; // -5 to +5 variation
          const nextValue = Math.max(0, Math.min(100, currentValue + nextVariation));
          
          // Set the data array to match the ordered labels
          dataset.data = [prevValue, currentValue, nextValue];
          
          // Update project totals for pie chart
          projectTotals[dataset.label] = prevValue + currentValue + nextValue;
        });
        
        // Sort datasets by their original order
        timeData.datasets.sort((a, b) => a.orderIndex - b.orderIndex);
        
      } else {
        // Fall back to sample data if no current project entries either
        // Create sample week labels that are in chronological order
        const today = new Date();
        const week1 = new Date(today);
        week1.setDate(week1.getDate() - 21); // 3 weeks ago
        
        const week2 = new Date(today);
        week2.setDate(week2.getDate() - 14); // 2 weeks ago
        
        const week3 = new Date(today);
        week3.setDate(week3.getDate() - 7); // 1 week ago
        
        const week4 = new Date(today); // Current week
        
        // Format the weeks
        timeData.labels = [
          formatWeekStart(week1),
          formatWeekStart(week2),
          formatWeekStart(week3),
          formatWeekStart(week4)
        ];
        
        const sampleProjects = ['Website Redesign', 'Mobile App', 'Infrastructure'];
        sampleProjects.forEach((project, index) => {
          const hue = (index * 120) % 360;
          const color = `hsl(${hue}, 70%, 60%)`;
          
          const data = [
            Math.floor(Math.random() * 40) + 10,
            Math.floor(Math.random() * 40) + 10,
            Math.floor(Math.random() * 40) + 10,
            Math.floor(Math.random() * 40) + 10
          ];
          
          timeData.datasets.push({
            label: project,
            data: data,
            backgroundColor: color,
            borderColor: color,
            borderWidth: 2,
            tension: 0.3,
            // Store index for consistent ordering
            orderIndex: index
          });
          
          // Add to project totals for the pie chart
          projectTotals[project] = data.reduce((sum, val) => sum + val, 0);
        });
      }
    }
    
    // Prepare pie chart data - use the weekly averages for actual submissions
    // or project totals for sample/projected data
    const pieChartData = {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: []
      }]
    };
    
    if (submissionWeeks.length > 0) {
      // Use weekly averages for the pie chart
      pieChartData.labels = Object.keys(weekTotals);
      pieChartData.datasets[0].data = Object.values(weekTotals);
    } else {
      // Use project totals for the pie chart (for sample/projected data)
      pieChartData.labels = Object.keys(projectTotals);
      pieChartData.datasets[0].data = Object.values(projectTotals);
    }
    
    // Generate colors for the pie chart
    pieChartData.datasets[0].backgroundColor = pieChartData.labels.map((projectName, index) => {
      // Find the project object to use its color
      const projectObj = projects.find(p => p.name === projectName);
      return projectObj?.color || `hsl(${(index * 137) % 360}, 70%, 60%)`;
    });
    
    return { 
      timeData, 
      totalData: pieChartData, 
      totalWeeks: totalWeeks 
    };
  }

  // Create time series chart as a streamgraph
  function createTimeSeriesChart(data) {
    const ctx = document.getElementById('time-series-chart').getContext('2d');
    
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
    
    new Chart(ctx, {
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
              // Reverse the legend order to match the visualization order
              reverse: true
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || '';
                const value = context.raw || 0;
                // Convert percentage to hours
                const hours = (value / 100) * 40;
                return `${label}: ${value}% (${hours.toFixed(1)} hours)`;
              }
            },
            padding: 10,
            bodySpacing: 5,
            cornerRadius: 6,
            titleFont: { weight: 'bold', size: 14 }
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
    
    new Chart(ctx, {
      type: 'pie',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0; // This is the average weekly percentage
                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                const percentage = Math.round((value / total) * 100);
                
                // Calculate weekly hours based on percentage of a 40-hour week
                const weeklyHours = (value / 100) * 40;
                
                // For total hours, multiply by the number of weeks
                const numWeeks = totalWeeks || 1;
                const totalHours = weeklyHours * numWeeks;
                
                if (totalWeeks > 1) {
                  return `${label}: ${value}% (${weeklyHours.toFixed(1)} hrs/week × ${numWeeks} weeks = ${totalHours.toFixed(1)} total hrs)`;
                } else {
                  return `${label}: ${value}% (${weeklyHours.toFixed(1)} hrs/week)`;
                }
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
});
