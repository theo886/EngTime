/**
 * Project Update Script
 * 
 * Run this script with Node.js to update the projects list in projectData.js
 * Usage: node updateProjects.js
 */

const fs = require('fs');
const path = require('path');

// Path to the project data file
const projectDataPath = path.join(__dirname, 'projectData.js');

// Define a color palette for projects
const colorPalette = [
    "#3498DB", // Bright Blue
    "#E74C3C", // Bright Red
    "#2ECC71", // Emerald Green
    "#9B59B6", // Amethyst Purple
    "#F1C40F", // Sunflower Yellow
    "#1ABC9C", // Turquoise
    "#E67E22", // Carrot Orange
    "#34495E", // Wet Asphalt (Dark Blue-Gray)
    "#D35400", // Pumpkin (Dark Orange)
    "#16A085", // Green Sea (Teal)
    "#8E44AD", // Wisteria (Deep Purple)
    "#27AE60", // Nephritis (Deep Green)
    "#F39C12", // Orange
    "#2980B9", // Belize Hole (Deep Blue)
    "#C0392B", // Pomegranate (Deep Red)
    "#7F8C8D", // Asbestos (Gray)
    "#D2B4DE", // Light Purple
    "#A3E4D7", // Light Teal
    "#F9E79F", // Light Yellow
    "#F5B7B1"  // Light Red
];

// List of projects to be maintained
const projects = [
  { id: "CP000022", name: "General R&D Infrastructure", code: "CP000022", color: colorPalette[0] },
  { id: "CP000038", name: "Stld Changeover Costs", code: "CP000038", color: colorPalette[1] },
  { id: "CP000039", name: "Unapplied Engineering Time", code: "CP000039", color: colorPalette[2] },
  { id: "MS000002", name: "NPI ST PX Series", code: "MS000002", color: colorPalette[3] },
  { id: "PE000005", name: "ENG MFG Support", code: "PE000005", color: colorPalette[4] },
  { id: "RD000026", name: "Sales Orders", code: "RD000026", color: colorPalette[5] },
  { id: "RD000027", name: "PMO-025 - PXG V3", code: "RD000027", color: colorPalette[6] },
  { id: "RD000042", name: "PX G 1300 Product Support", code: "RD000042", color: colorPalette[7] },
  { id: "RD000043", name: "PX G Controls", code: "RD000043", color: colorPalette[8] },
  { id: "RD000047", name: "PX Pump Train II", code: "RD000047", color: colorPalette[9] },
  { id: "RD000048", name: "DOE - PXG for Heat Pump", code: "RD000048", color: colorPalette[10] },
  { id: "VO000008", name: "Water Sales Support", code: "VO000008", color: colorPalette[11] },
  { id: "VO000009", name: "PX, Turbo, Pump, Support", code: "VO000009", color: colorPalette[12] },
  { id: "VO000010", name: "IPD Evaluation, PX Cost Reduction", code: "VO000010", color: colorPalette[13] },
  { id: "VO000011", name: "HP pump improvements", code: "VO000011", color: colorPalette[14] },
  { id: "VO000012", name: "PX Power Improvements", code: "VO000012", color: colorPalette[15] },
  { id: "VO000013", name: "PX Q500 Development", code: "VO000013", color: colorPalette[16] },
  { id: "WD000007", name: "PX Q400 COGS Reduction", code: "WD000007", color: colorPalette[17] },
  { id: "WD000009", name: "Turbo Std 550 and 875", code: "WD000009", color: colorPalette[18] }
];

/**
 * Get the next available project ID for a specific prefix
 * @param {Array} projects - Array of project objects
 * @param {string} prefix - The prefix for the ID (e.g., "CP", "RD")
 * @returns {string} The next available ID
 */
function getNextId(projects, prefix = "CP") {
  // Filter projects by prefix
  const prefixProjects = projects.filter(project => 
    typeof project.id === 'string' && project.id.startsWith(prefix)
  );
  
  if (prefixProjects.length === 0) {
    return `${prefix}000001`;
  }
  
  // Extract numbers and find the max
  const maxNumber = prefixProjects.reduce((max, project) => {
    const numPart = parseInt(project.id.substring(prefix.length), 10);
    return Math.max(max, isNaN(numPart) ? 0 : numPart);
  }, 0);
  
  // Format with leading zeros (assuming 6 digits)
  return `${prefix}${(maxNumber + 1).toString().padStart(6, '0')}`;
}

/**
 * Add a new project to the list
 * @param {string} name - The project name
 * @param {string} [prefix] - The prefix for the ID (e.g., "CP", "RD")
 * @param {string} [customColor] - Optional custom color (if not provided, one will be assigned)
 * @returns {Object} The created project
 */
function addProject(name, prefix = "CP", customColor = null) {
  const id = getNextId(projects, prefix);
  const code = id; // Use the ID as the code
  
  // Assign a color - either use the provided color or pick from the palette
  let color;
  if (customColor) {
    color = customColor;
  } else {
    // Use the project count modulo the color palette length to assign a color
    // This ensures we cycle through colors if we have more projects than colors
    const colorIndex = projects.length % colorPalette.length;
    color = colorPalette[colorIndex];
  }
  
  const newProject = { id, name, code, color };
  projects.push(newProject);
  return newProject;
}

/**
 * Generate the content for the projectData.js file
 * @returns {string} The file content
 */
function generateFileContent() {
  const header = `/**
 * Project Data Repository
 * 
 * This file contains the official list of projects available in the Weekly Percentage Tracker.
 * Each project has the following properties:
 * - id: A unique identifier for the project
 * - name: The display name of the project
 * - code: A project code (format: PREFIX-###)
 */

// Official projects data
const projectData = `;

  const projectsJson = JSON.stringify(projects, null, 2);
  
  const functions = `

/**
 * Get all available projects
 * @returns {Array} Array of project objects
 */
function getAllProjects() {
  return projectData;
}

/**
 * Get a project by its ID
 * @param {number} id - The project ID to search for
 * @returns {Object|null} The project object or null if not found
 */
function getProjectById(id) {
  return projectData.find(project => project.id === parseInt(id)) || null;
}

/**
 * Get a project by its code
 * @param {string} code - The project code to search for
 * @returns {Object|null} The project object or null if not found
 */
function getProjectByCode(code) {
  return projectData.find(project => project.code === code) || null;
}

// Expose the data and functions to the window object
window.projectData = {
  projects: projectData,
  getAllProjects,
  getProjectById,
  getProjectByCode
};`;

  return header + projectsJson + functions;
}

/**
 * Update the projectData.js file
 */
function updateProjectDataFile() {
  const fileContent = generateFileContent();
  fs.writeFileSync(projectDataPath, fileContent);
  console.log(`Updated ${projectDataPath} with ${projects.length} projects.`);
}

// Example usage:
// Uncomment the following lines to add new projects
// addProject('Customer Support Portal');
// addProject('Data Visualization Tool');

// Update the project data file
updateProjectDataFile(); 