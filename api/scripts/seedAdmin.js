/**
 * Seed script: Adds the initial admin user to the Azure Table Storage 'admins' table.
 *
 * Usage:
 *   Set AZURE_TABLE_STORAGE_CONNECTION_STRING env var, then run:
 *   node api/scripts/seedAdmin.js <userId> <userEmail>
 *
 * Example:
 *   node api/scripts/seedAdmin.js atheodossiou atheodossiou@example.com
 */
const { createTableClient } = require("../shared/tableClient");

const userId = process.argv[2];
const userEmail = process.argv[3];

if (!userId) {
    console.error("Usage: node api/scripts/seedAdmin.js <userId> [userEmail]");
    console.error("Example: node api/scripts/seedAdmin.js atheodossiou atheodossiou@example.com");
    process.exit(1);
}

if (!process.env.AZURE_TABLE_STORAGE_CONNECTION_STRING) {
    console.error("Error: AZURE_TABLE_STORAGE_CONNECTION_STRING environment variable is not set.");
    process.exit(1);
}

async function seed() {
    const tableClient = createTableClient("admins");

    const entity = {
        partitionKey: "admins",
        rowKey: userId,
        userEmail: userEmail || userId,
        addedBy: "seed-script",
        addedAt: new Date().toISOString()
    };

    try {
        await tableClient.upsertEntity(entity, "Merge");
        console.log(`Admin seeded successfully:`);
        console.log(`  userId:    ${userId}`);
        console.log(`  userEmail: ${userEmail || userId}`);
    } catch (err) {
        console.error(`Error seeding admin:`, err.message);
        process.exit(1);
    }
}

seed().catch(err => {
    console.error("Seed script failed:", err);
    process.exit(1);
});
