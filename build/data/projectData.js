/**
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
    "name": "Stld Changeover Costs",
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
    "name": "Sales Orders",
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
    "name": "PX Pump Train II",
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
    "id": "VO000008",
    "name": "Water Sales Support",
    "code": "VO000008",
    "color": "#27AE60"
  },
  {
    "id": "VO000009",
    "name": "PX, Turbo, Pump, Support",
    "code": "VO000009",
    "color": "#F39C12"
  },
  {
    "id": "VO000010",
    "name": "IPD Evaluation, PX Cost Reduction",
    "code": "VO000010",
    "color": "#2980B9"
  },
  {
    "id": "VO000011",
    "name": "HP pump improvements",
    "code": "VO000011",
    "color": "#C0392B"
  },
  {
    "id": "VO000012",
    "name": "PX Power Improvements",
    "code": "VO000012",
    "color": "#7F8C8D"
  },
  {
    "id": "VO000013",
    "name": "PX Q500 Development",
    "code": "VO000013",
    "color": "#D2B4DE"
  },
  {
    "id": "WD000007",
    "name": "PX Q400 COGS Reduction",
    "code": "WD000007",
    "color": "#A3E4D7"
  },
  {
    "id": "WD000009",
    "name": "Turbo Std 550 and 875",
    "code": "WD000009",
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