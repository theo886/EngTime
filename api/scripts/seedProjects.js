/**
 * Seed script: Loads projects from data/projectData.js into the Azure Table Storage 'projects' table.
 *
 * Usage:
 *   Set AZURE_TABLE_STORAGE_CONNECTION_STRING env var, then run:
 *   node api/scripts/seedProjects.js
 */
const path = require("path");

// Load the static project data by evaluating the file and extracting from the module pattern
const fs = require("fs");
const projectDataPath = path.join(__dirname, "../../data/projectData.js");
const projectDataSource = fs.readFileSync(projectDataPath, "utf-8");

// Extract the array from the source (it's assigned to `const projectData = [...]`)
const match = projectDataSource.match(/const projectData = (\[[\s\S]*?\])\s*\n/);
if (!match) {
    console.error("Could not parse project data from file.");
    process.exit(1);
}
const projectData = JSON.parse(match[1]);

const { createTableClient } = require("../shared/tableClient");

async function seed() {
    const tableClient = createTableClient("projects");

    console.log(`Seeding ${projectData.length} projects into 'projects' table...`);

    for (const project of projectData) {
        const entity = {
            partitionKey: "projects",
            rowKey: project.id,
            name: project.name,
            code: project.code,
            color: project.color || "#808080",
            isActive: true,
            createdAt: new Date(),
            createdBy: "seed-script"
        };

        try {
            await tableClient.upsertEntity(entity, "Merge");
            console.log(`  Seeded: ${project.id} — ${project.name}`);
        } catch (err) {
            console.error(`  ERROR seeding ${project.id}:`, err.message);
        }
    }

    console.log("Done seeding projects.");
}

seed().catch(err => {
    console.error("Seed script failed:", err);
    process.exit(1);
});
