e/**
 * Project Data Repository
 * 
 * This file contains the official list of projects available in the Weekly Percentage Tracker.
 * Each project has the following properties:
 * - id: A unique identifier for the project
 * - name: The display name of the project
 * - code: A project code (format: PREFIX-###)
 */

// Official projects data
const projectData = [
  {
    "id": "CP000022",
    "name": "General R&D Infrastructure",
    "code": "CP000022",
    "color": "#3498DB"
  },
  {
    "id": "CP000038",
    "name": "Skid Changeover Costs",
    "code": "CP000038",
    "color": "#E74C3C"
  },
  {
    "id": "CP000039",
    "name": "Unapplied Engineering Time",
    "code": "CP000039",
    "color": "#2ECC71"
  },
  {
    "id": "DD000200",
    "name": "Water Default Project Code",
    "code": "DD000200",
    "color": "#3498DB"  // Blue color for water
  },
  {
    "id": "DD000210",
    "name": "Waste Water Default Project Code",
    "code": "DD000210",
    "color": "#2C3E50"  // Dark blue-gray for waste water
  },
  {
    "id": "GE000001",
    "name": "Time Off / Holiday",
    "code": "GE000001",
    "color": "#95A5A6"  // Light gray for time off
  },
  {
    "id": "MS000002",
    "name": "NPI ST PX Series",
    "code": "MS000002",
    "color": "#9B59B6"
  },
  {
    "id": "PE000005",
    "name": "ENG MFG Support",
    "code": "PE000005",
    "color": "#F1C40F"
  },
  {
    "id": "RD000026",
    "name": "Sage Geosystems",
    "code": "RD000026",
    "color": "#1ABC9C"
  },
  {
    "id": "RD000027",
    "name": "PMO-025 - PXG V3",
    "code": "RD000027",
    "color": "#E67E22"
  },
  {
    "id": "RD000042",
    "name": "PX G 1300 Product Support",
    "code": "RD000042",
    "color": "#34495E"
  },
  {
    "id": "RD000043",
    "name": "PX G Controls",
    "code": "RD000043",
    "color": "#D35400"
  },
  {
    "id": "RD000047",
    "name": "PX Power Train II",
    "code": "RD000047",
    "color": "#16A085"
  },
  {
    "id": "RD000048",
    "name": "DOE - PXG for Heat Pump",
    "code": "RD000048",
    "color": "#8E44AD"
  },
  {
    "id": "VQ000008",
    "name": "Water Sales Support",
    "code": "VQ000008",
    "color": "#27AE60"
  },
  {
    "id": "VQ000009",
    "name": "PX, Turbo, Pump, Support",
    "code": "VQ000009",
    "color": "#F39C12"
  },
  {
    "id": "VQ000010",
    "name": "PX Part Reduction, PX Cost Reduction",
    "code": "VQ000010",
    "color": "#2980B9"
  },
  {
    "id": "VQ000011",
    "name": "HP pump improvements",
    "code": "VQ000011",
    "color": "#C0392B"
  },
  {
    "id": "VQ000012",
    "name": "ICAR/ Product Improvements",
    "code": "VQ000012",
    "color": "#7F8C8D"
  },
  { 
    "id": "VQ000013",
    "name": "Project Eagle",
    "code": "VQ000013",
    "color": "#D2B4DE"
  },
  { 
    "id": "VQ000014",
    "name": "Project Falcon",
    "code": "VQ000014",
    "color": "#8B4513"
  },
  {
    "id": "WI000004",
    "name": "Aquabold Improvements",
    "code": "WI000004",
    "color": "#3498DB" // Suitable color
  },
  {
    "id": "WI000007",
    "name": "PX Q400 COGS Reduction",
    "code": "WI000007",
    "color": "#A3E4D7"
  },
  {
    "id": "WI000009",
    "name": "Turbo Std 550 and 875",
    "code": "WI000009",
    "color": "#F9E79F"
  }
]

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
};
