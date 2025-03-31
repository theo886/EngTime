// Utility functions for the Weekly Percentage Tracker

/**
 * Validates the entries for total percentage and duplicate projects
 * @param {Array} entries - The entries to validate
 * @returns {string} Error message if validation fails, empty string otherwise
 */
function validateEntries(entries) {
  const total = calculateTotal(entries);
  
  if (total > 100) {
    return "Total percentage exceeds 100%";
  } else if (hasDuplicateProjects(entries)) {
    return "Duplicate projects are not allowed";
  }
  
  return "";
}

/**
 * Calculates the total percentage across all entries
 * @param {Array} entries - The entries to calculate total for
 * @returns {number} The total percentage
 */
function calculateTotal(entries) {
  return entries.reduce((sum, entry) => {
    const percentage = parseInt(entry.percentage) || 0;
    return sum + percentage;
  }, 0);
}

/**
 * Checks if there are any duplicate projects in the entries
 * @param {Array} entries - The entries to check
 * @returns {boolean} True if duplicates exist, false otherwise
 */
function hasDuplicateProjects(entries) {
  const projectIds = entries.map(entry => entry.projectId).filter(id => id); // Filter out empty IDs
  return new Set(projectIds).size !== projectIds.length;
}

/**
 * Redistributes percentages among non-manual entries
 * @param {Array} entries - All entries
 * @param {string} changedId - ID of the manually changed entry
 * @param {Set} manuallyEditedIds - Set of IDs that were manually edited
 * @returns {Array} Updated entries with redistributed percentages
 */
function redistributePercentages(entries, changedId, manuallyEditedIds) {
  // Get all manually set entries (including the one just changed)
  const manualEntries = entries.filter(entry => 
    entry.id === changedId || manuallyEditedIds.has(entry.id)
  );
  
  // Calculate the sum of manually set percentages
  const manualSum = manualEntries.reduce((sum, entry) => {
    return sum + (parseInt(entry.percentage) || 0);
  }, 0);
  
  // Get non-manual entries
  const nonManualEntries = entries.filter(entry => 
    entry.id !== changedId && !manuallyEditedIds.has(entry.id)
  );
  
  // If we have non-manual entries, distribute the remaining percentage
  if (nonManualEntries.length > 0) {
    const remainingPercentage = Math.max(0, 100 - manualSum);
    
    if (nonManualEntries.length === 1) {
      // If there's only one non-manual entry, give it all the remaining percentage
      return entries.map(entry => {
        if (entry.id === nonManualEntries[0].id) {
          return { ...entry, percentage: remainingPercentage.toString() };
        }
        return entry;
      });
    } else {
      // For multiple non-manual entries, distribute evenly
      const equalShare = remainingPercentage > 0 ? 
        Math.floor(remainingPercentage / nonManualEntries.length) : 0;
      
      const distributedTotal = equalShare * nonManualEntries.length;
      const remainder = remainingPercentage - distributedTotal;
      
      // First set equal shares
      let updatedEntries = entries.map(entry => {
        if (entry.id !== changedId && !manuallyEditedIds.has(entry.id)) {
          return { ...entry, percentage: equalShare.toString() };
        }
        return entry;
      });
      
      // Find the last non-manual entry to add any remainder
      let lastVisualNonManualEntry = null;
      for (let i = updatedEntries.length - 1; i >= 0; i--) {
        if (!manuallyEditedIds.has(updatedEntries[i].id) && updatedEntries[i].id !== changedId) {
          lastVisualNonManualEntry = updatedEntries[i];
          break;
        }
      }
      
      // Add remainder to last non-manual entry
      if (lastVisualNonManualEntry && remainder > 0) {
        return updatedEntries.map(entry => {
          if (entry.id === lastVisualNonManualEntry.id) {
            return { ...entry, percentage: (parseInt(entry.percentage) + remainder).toString() };
          }
          return entry;
        });
      }
      
      return updatedEntries;
    }
  }
  
  return entries;
}

/**
 * Formats a date range for a week
 * @param {Date} startDate - The start date of the week
 * @returns {string} Formatted date range string
 */
function formatWeekRange(startDate) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  
  const formatDate = (date) => {
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };
  
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

// Expose functions globally
window.utilsFunctions = {
  validateEntries,
  calculateTotal,
  hasDuplicateProjects, 
  redistributePercentages,
  formatWeekRange
}; 