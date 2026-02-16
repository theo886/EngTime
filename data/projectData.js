/**
 * Project Data Repository
 *
 * This file contains the official list of projects available in the Weekly Percentage Tracker.
 * Each project has the following properties:
 * - id: A unique identifier for the project
 * - name: The display name of the project
 */

// Official projects data
const projectData = [
  {
    "id": "CP000022",
    "name": "General R&D Infrastructure",
    "color": "#3498DB"
  },
  {
    "id": "CP000038",
    "name": "Skid Changeover Costs",
    "color": "#E74C3C"
  },
  {
    "id": "CP000039",
    "name": "Unapplied Engineering Time",
    "color": "#2ECC71"
  },
  {
    "id": "DD000200",
    "name": "Water Default Project Code",
    "color": "#3498DB"
  },
  {
    "id": "DD000210",
    "name": "Waste Water Default Project Code",
    "color": "#2C3E50"
  },
  {
    "id": "GE000001",
    "name": "Time Off / Holiday",
    "color": "#95A5A6"
  },
  {
    "id": "MS000002",
    "name": "NPI ST PX Series",
    "color": "#9B59B6"
  },
  {
    "id": "PE000005",
    "name": "ENG MFG Support",
    "color": "#F1C40F"
  },
  {
    "id": "RD000026",
    "name": "Sage Geosystems",
    "color": "#1ABC9C"
  },
  {
    "id": "RD000027",
    "name": "Skunkworks",
    "color": "#E67E22"
  },
  {
    "id": "RD000042",
    "name": "PX G 1300 Product Support",
    "color": "#34495E"
  },
  {
    "id": "RD000048",
    "name": "DOE - PXG for Heat Pump",
    "color": "#8E44AD"
  },
  {
    "id": "RD000049",
    "name": "PXG V2.5 Integration",
    "color": "#E91E63"
  },
  {
    "id": "RD000050",
    "name": "Eductor",
    "color": "#5D6D7E"
  },
  {
    "id": "RD000051",
    "name": "PX Lite",
    "color": "#48C9B0"
  },
  {
    "id": "VQ000003",
    "name": "R&D Technology Pipeline",
    "color": "#AF7AC5"
  },
  {
    "id": "VQ000008",
    "name": "Water Sales Support",
    "color": "#27AE60"
  },
  {
    "id": "VQ000009",
    "name": "PX, Turbo, Pump, Support",
    "color": "#F39C12"
  },
  {
    "id": "VQ000010",
    "name": "PX Part Reduction, PX Cost Reduction",
    "color": "#2980B9"
  },
  {
    "id": "VQ000011",
    "name": "HP pump improvements",
    "color": "#C0392B"
  },
  {
    "id": "VQ000012",
    "name": "ICAR/ Product Improvements",
    "color": "#7F8C8D"
  },
  {
    "id": "VQ000013",
    "name": "Project Eagle",
    "color": "#D2B4DE"
  },
  {
    "id": "VQ000014",
    "name": "Project Falcon",
    "color": "#8B4513"
  },
  {
    "id": "WI000004",
    "name": "Aquabold Improvements",
    "color": "#3498DB"
  },
  {
    "id": "WI000007",
    "name": "PX Q400 COGS Reduction",
    "color": "#A3E4D7"
  },
  {
    "id": "WI000009",
    "name": "Turbo Std 550 and 875",
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

// Expose the data and functions to the window object
window.projectData = {
  projects: projectData,
  getAllProjects,
  getProjectById
};
