/**
 * Setup script: Creates all required Azure Table Storage tables and
 * populates the users table from existing engtime data.
 *
 * Usage:
 *   AZURE_TABLE_STORAGE_CONNECTION_STRING="..." node api/scripts/setupTables.js
 *
 * Tables created:
 *   - projects   (project registry with Q1-Q4 budget columns)
 *   - engtime    (timesheet entries)
 *   - users      (replaces admins + usersettings tables)
 *
 * The script scans the engtime table to find all existing users and
 * populates the users table. Also checks the admins table to preserve
 * existing admin status.
 */
const { createTableClient } = require("../shared/tableClient");

if (!process.env.AZURE_TABLE_STORAGE_CONNECTION_STRING) {
    console.error("Error: AZURE_TABLE_STORAGE_CONNECTION_STRING environment variable is not set.");
    process.exit(1);
}

async function setup() {
    // 1. Create tables
    console.log("Creating tables...");
    const tables = ["projects", "engtime", "users"];
    for (const tableName of tables) {
        try {
            await createTableClient(tableName).createTable();
            console.log("  Created table: " + tableName);
        } catch (e) {
            console.log("  Table '" + tableName + "' already exists (skipped).");
        }
    }

    // 2. Scan engtime table for all unique users
    console.log("\nScanning engtime table for users...");
    const engtimeClient = createTableClient("engtime");
    const userMap = {};
    const entities = engtimeClient.listEntities();

    for await (const e of entities) {
        const uid = e.partitionKey;
        if (!userMap[uid]) {
            userMap[uid] = { email: "", earliestDate: null, latestDate: null };
        }
        if (e.userEmail) userMap[uid].email = e.userEmail;

        // Track earliest/latest submission dates for firstSeen/lastSeen
        const submitted = e.dateSubmitted ? new Date(e.dateSubmitted) : null;
        if (submitted && !isNaN(submitted)) {
            if (!userMap[uid].earliestDate || submitted < userMap[uid].earliestDate) {
                userMap[uid].earliestDate = submitted;
            }
            if (!userMap[uid].latestDate || submitted > userMap[uid].latestDate) {
                userMap[uid].latestDate = submitted;
            }
        }
    }

    const userIds = Object.keys(userMap);
    console.log("  Found " + userIds.length + " users.");

    // 3. Check existing admins table to preserve admin status
    console.log("\nChecking existing admins table...");
    const adminSet = new Set();
    try {
        const adminsClient = createTableClient("admins");
        const adminEntities = adminsClient.listEntities({
            queryOptions: { filter: "PartitionKey eq 'admins'" }
        });
        for await (const e of adminEntities) {
            adminSet.add(e.rowKey);
            console.log("  Found admin: " + e.rowKey + " (" + (e.userEmail || "no email") + ")");
        }
    } catch (e) {
        console.log("  No admins table found (skipping).");
    }

    // 4. Populate users table
    console.log("\nPopulating users table...");
    const usersClient = createTableClient("users");
    const now = new Date();

    for (const [uid, info] of Object.entries(userMap)) {
        const entity = {
            partitionKey: "users",
            rowKey: uid,
            email: info.email,
            isAdmin: adminSet.has(uid),
            defaultInputMode: "percent",
            firstSeen: info.earliestDate || now,
            lastSeen: info.latestDate || now
        };

        try {
            await usersClient.upsertEntity(entity, "Merge");
            const adminLabel = entity.isAdmin ? " [ADMIN]" : "";
            console.log("  " + uid + " | " + info.email + adminLabel);
        } catch (err) {
            console.error("  ERROR for " + uid + ": " + err.message);
        }
    }

    console.log("\nSetup complete. " + userIds.length + " users populated, " + adminSet.size + " admins preserved.");
    process.exit(0);
}

setup().catch(err => {
    console.error("Setup script failed:", err);
    process.exit(1);
});
