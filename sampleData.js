// Sample data for testing purposes only
// This file should not be used for production data

// Function to generate and load fake data for testing
function loadFakeDataForTesting(currentWeek, formatWeekRange) {
  // Reference the projects from the projectData module
  const projects = window.projectData.projects;
  
  // Selected project IDs to include in test data
  const fakeProjectIds = ["CP000022", "MS000002", "RD000026", "RD000047", "VO000009", "VO000013", "WD000007"];
  
  // Map of project names for quick reference
  const projectNames = {};
  fakeProjectIds.forEach(id => {
    const project = window.projectData.getProjectById(id);
    if (project) {
      projectNames[id] = project.name;
    }
  });
  
  // Generate dates for 5 consecutive weeks starting from 5 weeks ago
  const startDate = new Date(currentWeek);
  startDate.setDate(startDate.getDate() - (7 * 5)); // Start 5 weeks ago
  
  const weekDates = [];
  for (let i = 0; i < 5; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (i * 7));
    weekDates.push(weekStart);
  }
  
  // Story arcs for each project over 5 weeks
  const projectStories = {
    // General R&D Infrastructure: starts high, gradually decreases
    "CP000022": [35, 30, 25, 20, 15],
    
    // NPI ST PX Series: starts low, increases, then plateaus 
    "MS000002": [15, 25, 35, 35, 30],
    
    // Sales Orders: steady in the middle
    "RD000026": [20, 20, 15, 20, 20],
    
    // PX Pump Train II: not present initially, increases later
    "RD000047": [0, 5, 10, 15, 20],
    
    // PX, Turbo, Pump, Support: starts high, decreases, then disappears
    "VO000009": [30, 20, 15, 10, 0],
    
    // PX Q500 Development: appears in later weeks
    "VO000013": [0, 0, 0, 0, 15],
    
    // PX Q400 COGS Reduction: small consistent allocation
    "WD000007": [0, 0, 0, 0, 0]
  };
  
  const previousSubmissions = {};
  
  // Generate entries for each week
  weekDates.forEach((date, weekIndex) => {
    const weekKey = formatWeekRange(date);
    const weekEntries = [];
    
    // Create entries for each project for this week
    fakeProjectIds.forEach(projectId => {
      const percentage = projectStories[projectId][weekIndex];
      
      // Only add projects with non-zero allocation
      if (percentage > 0) {
        weekEntries.push({
          id: Date.now() + Math.random(), // Generate unique ID
          projectId: projectId,
          projectName: projectNames[projectId],
          percentage: percentage.toString()
        });
      }
    });
    
    // Ensure percentages add up to 100%
    const totalPercentage = weekEntries.reduce((sum, entry) => sum + parseInt(entry.percentage), 0);
    if (totalPercentage !== 100 && weekEntries.length > 0) {
      // Add or subtract from the last entry to make total 100%
      const lastEntry = weekEntries[weekEntries.length - 1];
      const adjustment = 100 - totalPercentage;
      lastEntry.percentage = (parseInt(lastEntry.percentage) + adjustment).toString();
    }
    
    // Store in previousSubmissions
    previousSubmissions[weekKey] = weekEntries;
  });
  
  console.log("Fake data loaded for the following weeks:", Object.keys(previousSubmissions));
  return previousSubmissions;
}

// Expose function globally
window.loadFakeDataForTesting = loadFakeDataForTesting; 