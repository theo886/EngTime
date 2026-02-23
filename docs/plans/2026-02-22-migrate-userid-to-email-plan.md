# Migrate userId to Email — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Switch all user identification from unstable Azure SWA `userId` to stable `email` (from `clientPrincipal.userDetails`).

**Architecture:** Two-phase deploy. Phase 1 adds a migration endpoint that copies userId-keyed data to email-keyed data in Azure Table Storage. Phase 2 switches all API functions, frontend, and mock server to use email as the primary key. Old userId-keyed records are preserved for rollback safety.

**Tech Stack:** Node.js Azure Functions v2, vanilla JS frontend, Azure Table Storage (`@azure/data-tables`).

**Design doc:** `docs/plans/2026-02-22-migrate-userid-to-email-design.md`

---

## Phase 1: Migration Endpoint (Deploy 1)

### Task 1: Create MigrateToEmail function.json

**Files:**
- Create: `api/MigrateToEmail/function.json`

**Step 1: Create the function config**

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get"]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

**Step 2: Commit**

```bash
git add api/MigrateToEmail/function.json
git commit -m "feat: add MigrateToEmail function config"
```

---

### Task 2: Create MigrateToEmail endpoint

**Files:**
- Create: `api/MigrateToEmail/index.js`

**Context:** This admin-only endpoint reads all userId-keyed records from `users` and `engtime` tables and creates email-keyed copies. It uses `upsertEntity("Merge")` so it's idempotent (safe to re-run). Old records are NOT deleted.

**Step 1: Write the migration endpoint**

```js
const { createTableClient, getUserInfo, isAdmin, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('MigrateToEmail function processing request.');

    const clientPrincipal = getUserInfo(req);
    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    if (!isAllowedDomain(clientPrincipal)) {
        context.res = { status: 403, body: "Access restricted to energyrecovery.com accounts." };
        return;
    }

    const adminStatus = await isAdmin(clientPrincipal.userId);
    if (!adminStatus) {
        context.res = { status: 403, body: "Admin access required." };
        return;
    }

    const usersClient = createTableClient("users");
    const engtimeClient = createTableClient("engtime");

    const results = {
        users: { migrated: 0, skipped: 0, failed: 0, errors: [] },
        engtime: { migrated: 0, skipped: 0, failed: 0, errors: [] }
    };

    try {
        // Step 1: Read all users and build userId → email map
        const userIdToEmail = {};
        const userEntities = [];
        const allUsers = usersClient.listEntities({
            queryOptions: { filter: "PartitionKey eq 'users'" }
        });

        for await (const entity of allUsers) {
            userEntities.push(entity);
            if (entity.email) {
                userIdToEmail[entity.rowKey] = entity.email.toLowerCase();
            }
        }

        context.log(`Found ${userEntities.length} user records. ${Object.keys(userIdToEmail).length} have email addresses.`);

        // Step 2: Create email-keyed copies in users table
        for (const entity of userEntities) {
            const email = entity.email ? entity.email.toLowerCase() : null;
            if (!email) {
                results.users.skipped++;
                continue;
            }

            // Skip if rowKey is already an email (already migrated)
            if (entity.rowKey.includes('@')) {
                results.users.skipped++;
                continue;
            }

            try {
                const newEntity = {
                    partitionKey: "users",
                    rowKey: email,
                    email: email,
                    displayName: entity.displayName || "",
                    isAdmin: entity.isAdmin === true,
                    defaultInputMode: entity.defaultInputMode || "percent",
                    firstSeen: entity.firstSeen || new Date(),
                    lastSeen: entity.lastSeen || new Date()
                };
                await usersClient.upsertEntity(newEntity, "Merge");
                results.users.migrated++;
            } catch (err) {
                results.users.failed++;
                results.users.errors.push(`${entity.rowKey}: ${err.message}`);
                context.log.error(`Failed to migrate user ${entity.rowKey}: ${err.message}`);
            }
        }

        // Step 3: Read all engtime records and create email-keyed copies
        const allEngtime = engtimeClient.listEntities();
        let engtimeCount = 0;

        for await (const entity of allEngtime) {
            engtimeCount++;
            const currentPartitionKey = entity.partitionKey;

            // Skip if partitionKey is already an email (already migrated)
            if (currentPartitionKey.includes('@')) {
                results.engtime.skipped++;
                continue;
            }

            // Look up email for this userId
            const email = userIdToEmail[currentPartitionKey];
            if (!email) {
                // Try the userEmail field on the entity itself
                if (entity.userEmail) {
                    userIdToEmail[currentPartitionKey] = entity.userEmail.toLowerCase();
                } else {
                    results.engtime.skipped++;
                    continue;
                }
            }

            const targetEmail = userIdToEmail[currentPartitionKey];

            try {
                const newEntity = {
                    partitionKey: targetEmail,
                    rowKey: entity.rowKey,
                    userId: targetEmail,
                    week: entity.week || "",
                    weekStartDate: entity.weekStartDate || "",
                    projectId: entity.projectId || "",
                    projectName: entity.projectName || "",
                    percentage: entity.percentage || 0,
                    userEmail: targetEmail,
                    hours: entity.hours || 0,
                    dateSubmitted: entity.dateSubmitted || new Date()
                };
                await engtimeClient.upsertEntity(newEntity, "Merge");
                results.engtime.migrated++;
            } catch (err) {
                results.engtime.failed++;
                results.engtime.errors.push(`${currentPartitionKey}/${entity.rowKey}: ${err.message}`);
                context.log.error(`Failed to migrate engtime ${currentPartitionKey}/${entity.rowKey}: ${err.message}`);
            }
        }

        context.log(`Processed ${engtimeCount} engtime records.`);

        // Trim error arrays to first 20
        results.users.errors = results.users.errors.slice(0, 20);
        results.engtime.errors = results.engtime.errors.slice(0, 20);

        context.res = {
            status: 200,
            body: {
                success: true,
                userIdToEmailMap: userIdToEmail,
                results
            }
        };
    } catch (err) {
        context.log.error("Migration error:", err);
        context.res = { status: 500, body: `Migration error: ${err.message}` };
    }
};
```

**Step 2: Commit**

```bash
git add api/MigrateToEmail/index.js
git commit -m "feat: add MigrateToEmail admin endpoint for userId-to-email data migration"
```

**Step 3: Deploy and verify**

Deploy to Azure (push to main). Then call the endpoint:
```
GET /api/MigrateToEmail
```
Expected response: JSON with `success: true` and counts for migrated users/engtime records. Spot-check Azure Table Storage to confirm email-keyed records exist alongside old userId-keyed records.

---

## Phase 2: Switch All Code to Email (Deploy 2)

### Task 3: Update core identity module (tableClient.js)

**Files:**
- Modify: `api/shared/tableClient.js`

**Context:** This is the shared module all API functions import. We add `getUserEmail()`, update `isAdmin()` to look up by email, and update `ensureUser()` to write email-keyed records.

**Step 1: Add getUserEmail helper and update isAdmin + ensureUser**

In `api/shared/tableClient.js`:

1. Add `getUserEmail` function after `getUserInfo` (after line 54):

```js
/**
 * Extracts the user's email from the client principal, lowercased.
 * This is the primary user identifier (stable across SWA config changes).
 */
function getUserEmail(clientPrincipal) {
    if (!clientPrincipal || !clientPrincipal.userDetails) return null;
    return clientPrincipal.userDetails.toLowerCase();
}
```

2. Change `isAdmin` parameter semantics (line 59): the function already takes a string and does `getEntity("users", <string>)`. No code change needed to the function body — just the callers will pass email instead of userId. Update the JSDoc comment:

```js
/**
 * Checks if the given user email has isAdmin=true in the users table.
 */
async function isAdmin(userEmail) {
```

3. Update `ensureUser` (lines 75-111) to use email as the key:

```js
async function ensureUser(req) {
    const clientPrincipal = getUserInfo(req);
    const userEmail = getUserEmail(clientPrincipal);
    if (!userEmail) return;
    if (!isAllowedDomain(clientPrincipal)) return;

    try {
        const usersClient = createTableClient("users");
        const now = new Date();
        const entity = {
            partitionKey: "users",
            rowKey: userEmail,
            email: userEmail,
            lastSeen: now
        };

        // Check if user exists — if not, set firstSeen and defaults
        try {
            const existing = await usersClient.getEntity("users", userEmail);
            // Backfill displayName for existing users who don't have one yet
            if (!existing.displayName && clientPrincipal.displayName) {
                entity.displayName = clientPrincipal.displayName;
            }
        } catch (e) {
            if (e.statusCode === 404) {
                entity.firstSeen = now;
                entity.isAdmin = false;
                entity.defaultInputMode = "percent";
                entity.displayName = clientPrincipal.displayName || "";
            }
        }

        await usersClient.upsertEntity(entity, "Merge");
    } catch (e) {
        // Non-fatal — don't block the request if user tracking fails
        console.error("ensureUser error:", e.message);
    }
}
```

4. Update the exports line (line 113):

```js
module.exports = { createTableClient, getUserInfo, getUserEmail, isAdmin, ensureUser, isAllowedDomain };
```

**Step 2: Commit**

```bash
git add api/shared/tableClient.js
git commit -m "feat: add getUserEmail helper, switch isAdmin/ensureUser to email-keyed lookups"
```

---

### Task 4: Update auth-only API functions

**Files:**
- Modify: `api/CheckAdmin/index.js`
- Modify: `api/GetProjects/index.js`
- Modify: `api/GetProjectAnalytics/index.js`
- Modify: `api/GetProjectBudgets/index.js`
- Modify: `api/PopulateDisplayNames/index.js`

**Context:** These functions only use userId for the null-check and `isAdmin()` call. The mechanical pattern is the same in all five files.

**Pattern for all five files:**

1. Update the require line to include `getUserEmail`:
```js
const { ..., getUserEmail, ... } = require("../shared/tableClient");
```

2. Replace this block:
```js
if (!clientPrincipal || !clientPrincipal.userId) {
    context.res = { status: 401, body: "User not authenticated." };
    return;
}
```
With:
```js
const userEmail = getUserEmail(clientPrincipal);
if (!clientPrincipal || !userEmail) {
    context.res = { status: 401, body: "User not authenticated." };
    return;
}
```

3. Replace `isAdmin(clientPrincipal.userId)` with `isAdmin(userEmail)`.

**Specific changes per file:**

**`api/CheckAdmin/index.js`:**
- Line 1: add `getUserEmail` to imports
- Lines 7-9: add `const userEmail = getUserEmail(clientPrincipal);`, change null-check to `!userEmail`
- Line 20: `await isAdmin(userEmail)`

**`api/GetProjects/index.js`:**
- Line 1: add `getUserEmail` to imports
- Lines 7-9: add `const userEmail`, change null-check
- (No isAdmin call in this file — just auth + ensureUser)

**`api/GetProjectAnalytics/index.js`:**
- Line 1: add `getUserEmail` to imports
- Lines 10-12: add `const userEmail`, change null-check
- Line 22: `await isAdmin(userEmail)`

**`api/GetProjectBudgets/index.js`:**
- Line 1: add `getUserEmail` to imports
- Lines 9-11: add `const userEmail`, change null-check
- Line 14: `await isAdmin(userEmail)`

**`api/PopulateDisplayNames/index.js`:**
- Line 2: add `getUserEmail` to imports
- Lines 8-10: add `const userEmail`, change null-check
- Line 20: `await isAdmin(userEmail)`
- Line 94: `rowKey: user.userId` stays as-is (this is iterating existing records, not the caller)

**Step 1: Apply all five changes**

Apply the pattern described above to each of the five files.

**Step 2: Commit**

```bash
git add api/CheckAdmin/index.js api/GetProjects/index.js api/GetProjectAnalytics/index.js api/GetProjectBudgets/index.js api/PopulateDisplayNames/index.js
git commit -m "feat: switch auth-only API functions to email-based identity"
```

---

### Task 5: Update current-user table key functions

**Files:**
- Modify: `api/GetAllTimeAllocations/index.js`
- Modify: `api/SaveTimeAllocation/index.js`
- Modify: `api/GetUserSettings/index.js`
- Modify: `api/SaveUserSettings/index.js`

**Context:** These functions use userId as a PartitionKey or RowKey to read/write the current user's data. They need the same auth pattern change PLUS table key changes.

**`api/GetAllTimeAllocations/index.js`:**
- Line 1: add `getUserEmail` to imports
- After line 8: add `const userEmail = getUserEmail(clientPrincipal);`
- Line 10: change null-check to `!userEmail`
- Line 22: remove `const userId = clientPrincipal.userId;`
- Line 27: change filter to `PartitionKey eq '${userEmail}'`

Full updated file:
```js
const { createTableClient, getUserInfo, getUserEmail, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetAllTimeAllocations function processing request.');

    const tableClient = createTableClient("engtime");

    const clientPrincipal = getUserInfo(req);
    const userEmail = getUserEmail(clientPrincipal);

    if (!clientPrincipal || !userEmail) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    if (!isAllowedDomain(clientPrincipal)) {
        context.res = { status: 403, body: "Access restricted to energyrecovery.com accounts." };
        return;
    }

    await ensureUser(req);

    try {
        const resultsByWeek = {};
        const entities = tableClient.listEntities({
            queryOptions: { filter: `PartitionKey eq '${userEmail}'` }
        });

        for await (const entity of entities) {
            const weekKey = entity.week;
            if (!weekKey) {
                context.log.warn(`Entity missing 'week' property: PartitionKey=${entity.partitionKey}, RowKey=${entity.rowKey}`);
                continue;
            }

            if (!resultsByWeek[weekKey]) {
                resultsByWeek[weekKey] = [];
            }
            resultsByWeek[weekKey].push({
                ProjectId: entity.projectId,
                Percentage: entity.percentage
            });
        }

        context.res = {
            status: 200,
            body: resultsByWeek
        };

    } catch (err) {
        context.log.error("Table Storage Query Error:", err);
        context.res = { status: 500, body: `Table Storage error: ${err.message}` };
    }
};
```

**`api/SaveTimeAllocation/index.js`:**
- Line 1: add `getUserEmail` to imports
- After line 9: add `const userEmail = getUserEmail(clientPrincipal);`
- Line 11: change null-check to `!userEmail`
- Line 23: remove `const userId = clientPrincipal.userId;`
- Line 36: filter changes to `PartitionKey eq '${userEmail}'`
- Line 41: log uses `userEmail`
- Line 66: `partitionKey: userEmail`
- Line 68: `userId: userEmail`
- Line 103: Power Automate payload `userId: userEmail`

Full updated file:
```js
const { createTableClient, getUserInfo, getUserEmail, ensureUser, isAllowedDomain } = require("../shared/tableClient");
const axios = require('axios');

module.exports = async function (context, req) {
    context.log('SaveTimeAllocation function processing request.');

    const tableClient = createTableClient("engtime");

    const clientPrincipal = getUserInfo(req);
    const userEmail = getUserEmail(clientPrincipal);

    if (!clientPrincipal || !userEmail) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    if (!isAllowedDomain(clientPrincipal)) {
        context.res = { status: 403, body: "Access restricted to energyrecovery.com accounts." };
        return;
    }

    await ensureUser(req);

    const { week, WeekStartDate, entries } = req.body;
    const dateSubmitted = new Date();

    if (!week || !Array.isArray(entries)) {
        context.res = { status: 400, body: "Invalid request body. Expecting 'week' and 'entries' array." };
        return;
    }

    try {
        // Step 1: Find existing entities for this user and week
        const existingEntities = [];
        const entitiesToDelete = tableClient.listEntities({
            queryOptions: { filter: `PartitionKey eq '${userEmail}' and week eq '${week}'` }
        });
        for await (const entity of entitiesToDelete) {
            existingEntities.push({ partitionKey: entity.partitionKey, rowKey: entity.rowKey });
        }
        context.log(`Found ${existingEntities.length} existing entities for user ${userEmail}, week ${week} to delete.`);

        // Step 2: DELETE batch transaction
        if (existingEntities.length > 0) {
            const deleteBatch = existingEntities.map(entityMeta =>
                ["delete", { partitionKey: entityMeta.partitionKey, rowKey: entityMeta.rowKey }]
            );
            context.log(`Submitting delete batch with ${deleteBatch.length} operations.`);
            const deleteResponse = await tableClient.submitTransaction(deleteBatch);
            context.log(`Delete batch transaction submitted. Status: ${deleteResponse.status}`);
        } else {
            context.log("No existing entities found for this week, skipping delete batch.");
        }

        // Step 3: UPSERT batch transaction
        const upsertBatch = [];
        const validEntries = entries.filter(entry => entry.projectId);

        validEntries.forEach(entry => {
            const percentage = parseInt(entry.percentage);
            const hours = parseFloat((percentage * 0.4).toFixed(1));
            const weekStartDateClean = (WeekStartDate || week.split(' - ')[0]).replace(/\//g, '-');
            const rowKey = `${weekStartDateClean}_${entry.projectId}`;

            const newEntity = {
                partitionKey: userEmail,
                rowKey: rowKey,
                userId: userEmail,
                week: week,
                weekStartDate: WeekStartDate || week.split(' - ')[0],
                projectId: entry.projectId,
                projectName: entry.projectName || 'Unknown Project',
                percentage: percentage,
                userEmail: userEmail,
                hours: hours,
                dateSubmitted: dateSubmitted
            };
            upsertBatch.push(["upsert", newEntity]);
        });

        if (upsertBatch.length > 0) {
            context.log(`Submitting upsert batch with ${upsertBatch.length} operations.`);
            const upsertResponse = await tableClient.submitTransaction(upsertBatch);
            context.log(`Upsert batch transaction submitted. Status: ${upsertResponse.status}`);
        } else {
             context.log("No valid entries to upsert, skipping upsert batch.");
        }

        // Step 4: Trigger Power Automate
        // NOTE: userId field NAME stays the same (Power Automate contract), VALUE is now email
        const powerAutomateUrl = process.env.POWER_AUTOMATE_SAVE_URL;
        if (powerAutomateUrl) {
             const entriesWithHours = validEntries.map(entry => {
                 const percentage = parseInt(entry.percentage);
                 const hours = parseFloat((percentage * 0.4).toFixed(1));
                 return {
                     projectId: entry.projectId,
                     projectName: entry.projectName || 'Unknown Project',
                     percentage: percentage,
                     hours: hours
                 };
             });
             const excelPayload = {
                 userId: userEmail,
                 userEmail: userEmail,
                 week: week,
                 weekStartDate: WeekStartDate || week.split(' - ')[0],
                 dateSubmitted: dateSubmitted.toISOString(),
                 entries: entriesWithHours
             };

             axios.post(powerAutomateUrl, excelPayload)
                 .then(response => {
                     context.log(`Successfully triggered Excel update flow. Status: ${response.status}`);
                 })
                 .catch(paError => {
                     context.log.error('Error triggering Power Automate flow:', paError.message);
                     if (paError.response) {
                         context.log.error('Power Automate Error Response:', paError.response.data);
                     }
                 });
        } else {
            context.log.warn('POWER_AUTOMATE_SAVE_URL environment variable not set. Skipping Excel update.');
        }

        context.res = { status: 200, body: { message: "Timesheet saved successfully." } };

    } catch (err) {
        context.log.error("Table Storage Save/Transaction Error:", err);
        if (err.details && err.details.error && err.details.error.code) {
             context.res = { status: 500, body: `Table Storage transaction error: ${err.details.error.code} - ${err.details.error.message}` };
        } else {
             context.res = { status: 500, body: `Table Storage error: ${err.message}` };
        }
    }
};
```

**Note on SaveTimeAllocation:** The `userEmail` field from `req.body` is no longer needed for identification — the authenticated user's email from the header is used instead. The `req.body.userEmail` was previously used but is now replaced by `userEmail` from `getUserEmail()`. The validation check for `!userEmail` in the request body is removed since we derive it from auth.

**`api/GetUserSettings/index.js`:**
Full updated file:
```js
const { createTableClient, getUserInfo, getUserEmail, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetUserSettings function processing request.');

    const clientPrincipal = getUserInfo(req);
    const userEmail = getUserEmail(clientPrincipal);

    if (!clientPrincipal || !userEmail) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    if (!isAllowedDomain(clientPrincipal)) {
        context.res = { status: 403, body: "Access restricted to energyrecovery.com accounts." };
        return;
    }

    await ensureUser(req);

    try {
        const usersClient = createTableClient("users");
        const entity = await usersClient.getEntity("users", userEmail);
        context.res = {
            status: 200,
            body: {
                defaultInputMode: entity.defaultInputMode || "percent",
            }
        };
    } catch (err) {
        if (err.statusCode === 404) {
            context.res = {
                status: 200,
                body: { defaultInputMode: "percent" }
            };
        } else {
            context.log.error("Error fetching user settings:", err);
            context.res = { status: 500, body: `Error fetching settings: ${err.message}` };
        }
    }
};
```

**`api/SaveUserSettings/index.js`:**
Full updated file:
```js
const { createTableClient, getUserInfo, getUserEmail, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('SaveUserSettings function processing request.');

    const clientPrincipal = getUserInfo(req);
    const userEmail = getUserEmail(clientPrincipal);

    if (!clientPrincipal || !userEmail) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    if (!isAllowedDomain(clientPrincipal)) {
        context.res = { status: 403, body: "Access restricted to energyrecovery.com accounts." };
        return;
    }

    await ensureUser(req);

    const { defaultInputMode } = req.body || {};

    const validModes = ["percent", "hours"];
    if (!defaultInputMode || !validModes.includes(defaultInputMode)) {
        context.res = { status: 400, body: "Invalid request. 'defaultInputMode' must be 'percent' or 'hours'." };
        return;
    }

    try {
        const usersClient = createTableClient("users");
        const entity = {
            partitionKey: "users",
            rowKey: userEmail,
            defaultInputMode: defaultInputMode
        };

        await usersClient.upsertEntity(entity, "Merge");

        context.res = {
            status: 200,
            body: { message: "Settings saved successfully.", defaultInputMode }
        };
    } catch (err) {
        context.log.error("Error saving user settings:", err);
        context.res = { status: 500, body: `Error saving settings: ${err.message}` };
    }
};
```

**Step 1: Apply all four file changes**

Replace each file's contents with the updated versions above.

**Step 2: Commit**

```bash
git add api/GetAllTimeAllocations/index.js api/SaveTimeAllocation/index.js api/GetUserSettings/index.js api/SaveUserSettings/index.js
git commit -m "feat: switch current-user table key functions to email-based identity"
```

---

### Task 6: Update admin target functions

**Files:**
- Modify: `api/UpdateUser/index.js`
- Modify: `api/SaveTimeAllocationForUser/index.js`
- Modify: `api/GetAllUsersTimesheets/index.js`
- Modify: `api/GetUsers/index.js`

**`api/UpdateUser/index.js`:**

Changes:
- Import `getUserEmail`
- Auth null-check uses `userEmail`
- `isAdmin(userEmail)` instead of `isAdmin(clientPrincipal.userId)`
- Request body: `userId` → `userEmail` (the target user to toggle)
- Self-check compares emails: `targetUserEmail === userEmail`
- Table lookups use the target email

Full updated file:
```js
const { createTableClient, getUserInfo, getUserEmail, isAdmin, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('UpdateUser function processing request.');

    const clientPrincipal = getUserInfo(req);
    const userEmail = getUserEmail(clientPrincipal);

    if (!clientPrincipal || !userEmail) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    if (!isAllowedDomain(clientPrincipal)) {
        context.res = { status: 403, body: "Access restricted to energyrecovery.com accounts." };
        return;
    }

    await ensureUser(req);

    const adminStatus = await isAdmin(userEmail);
    if (!adminStatus) {
        context.res = { status: 403, body: "Admin access required." };
        return;
    }

    const { action, userEmail: targetUserEmail } = req.body || {};

    if (!action || !targetUserEmail) {
        context.res = { status: 400, body: "Missing required fields: 'action' and 'userEmail'." };
        return;
    }

    try {
        const usersClient = createTableClient("users");

        if (action === 'toggleAdmin') {
            // Prevent removing yourself as admin
            if (targetUserEmail.toLowerCase() === userEmail) {
                context.res = { status: 400, body: "Cannot toggle your own admin status." };
                return;
            }

            // Get current user record
            let entity;
            try {
                entity = await usersClient.getEntity("users", targetUserEmail.toLowerCase());
            } catch (e) {
                if (e.statusCode === 404) {
                    context.res = { status: 404, body: `User '${targetUserEmail}' not found.` };
                    return;
                }
                throw e;
            }

            const newAdminStatus = !(entity.isAdmin === true);
            await usersClient.upsertEntity({
                partitionKey: "users",
                rowKey: targetUserEmail.toLowerCase(),
                isAdmin: newAdminStatus
            }, "Merge");

            context.res = {
                status: 200,
                body: { message: `User '${targetUserEmail}' admin status set to ${newAdminStatus}.`, isAdmin: newAdminStatus }
            };
        } else {
            context.res = { status: 400, body: "Invalid action. Use 'toggleAdmin'." };
        }
    } catch (err) {
        context.log.error("Error updating user:", err);
        context.res = { status: 500, body: `Error updating user: ${err.message}` };
    }
};
```

**`api/SaveTimeAllocationForUser/index.js`:**

Changes:
- Import `getUserEmail`
- Auth uses `userEmail`
- Request body: `targetUserId` → `targetUserEmail`
- PartitionKey, entity fields, Power Automate payload all use `targetUserEmail`
- `submittedBy` uses caller's `userEmail`

Full updated file:
```js
const axios = require('axios');
const { createTableClient, getUserInfo, getUserEmail, isAdmin, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('SaveTimeAllocationForUser function processing request.');

    const tableClient = createTableClient("engtime");

    const clientPrincipal = getUserInfo(req);
    const userEmail = getUserEmail(clientPrincipal);

    if (!clientPrincipal || !userEmail) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    if (!isAllowedDomain(clientPrincipal)) {
        context.res = { status: 403, body: "Access restricted to energyrecovery.com accounts." };
        return;
    }

    await ensureUser(req);

    const adminStatus = await isAdmin(userEmail);
    if (!adminStatus) {
        context.res = { status: 403, body: "Admin access required." };
        return;
    }

    const { targetUserEmail, week, WeekStartDate, entries } = req.body || {};

    if (!targetUserEmail || !week || !Array.isArray(entries)) {
        context.res = { status: 400, body: "Missing required fields: 'targetUserEmail', 'week', and 'entries' array." };
        return;
    }

    const targetEmail = targetUserEmail.toLowerCase();
    const dateSubmitted = new Date();

    try {
        // Step 1: Delete existing entries for target user and week
        const existingEntities = [];
        const entitiesToDelete = tableClient.listEntities({
            queryOptions: { filter: `PartitionKey eq '${targetEmail}' and week eq '${week}'` }
        });
        for await (const entity of entitiesToDelete) {
            existingEntities.push({ partitionKey: entity.partitionKey, rowKey: entity.rowKey });
        }

        if (existingEntities.length > 0) {
            const deleteBatch = existingEntities.map(entityMeta =>
                ["delete", { partitionKey: entityMeta.partitionKey, rowKey: entityMeta.rowKey }]
            );
            await tableClient.submitTransaction(deleteBatch);
            context.log(`Deleted ${deleteBatch.length} existing entries for user ${targetEmail}, week ${week}.`);
        }

        // Step 2: Insert new entries
        const upsertBatch = [];
        const validEntries = entries.filter(entry => entry.projectId);

        validEntries.forEach(entry => {
            const percentage = parseInt(entry.percentage);
            const hours = parseFloat((percentage * 0.4).toFixed(1));
            const weekStartDateClean = (WeekStartDate || week.split(' - ')[0]).replace(/\//g, '-');
            const rowKey = `${weekStartDateClean}_${entry.projectId}`;

            const newEntity = {
                partitionKey: targetEmail,
                rowKey: rowKey,
                userId: targetEmail,
                week: week,
                weekStartDate: WeekStartDate || week.split(' - ')[0],
                projectId: entry.projectId,
                projectName: entry.projectName || 'Unknown Project',
                percentage: percentage,
                userEmail: targetEmail,
                hours: hours,
                dateSubmitted: dateSubmitted,
                submittedBy: userEmail
            };
            upsertBatch.push(["upsert", newEntity]);
        });

        if (upsertBatch.length > 0) {
            await tableClient.submitTransaction(upsertBatch);
            context.log(`Upserted ${upsertBatch.length} entries for user ${targetEmail}, week ${week}.`);
        }

        // Step 3: Trigger Power Automate
        // NOTE: userId field NAME stays the same (PA contract), VALUE is now email
        const powerAutomateUrl = process.env.POWER_AUTOMATE_SAVE_URL;
        if (powerAutomateUrl) {
            const entriesWithHours = validEntries.map(entry => {
                const percentage = parseInt(entry.percentage);
                const hours = parseFloat((percentage * 0.4).toFixed(1));
                return {
                    projectId: entry.projectId,
                    projectName: entry.projectName || 'Unknown Project',
                    percentage: percentage,
                    hours: hours
                };
            });
            const excelPayload = {
                userId: targetEmail,
                userEmail: targetEmail,
                week: week,
                weekStartDate: WeekStartDate || week.split(' - ')[0],
                dateSubmitted: dateSubmitted.toISOString(),
                entries: entriesWithHours
            };

            axios.post(powerAutomateUrl, excelPayload)
                .then(response => {
                    context.log(`Successfully triggered Power Automate for admin edit. Status: ${response.status}`);
                })
                .catch(paError => {
                    context.log.error('Error triggering Power Automate flow:', paError.message);
                    if (paError.response) {
                        context.log.error('Power Automate Error Response:', paError.response.data);
                    }
                });
        } else {
            context.log.warn('POWER_AUTOMATE_SAVE_URL not set. Skipping Power Automate trigger.');
        }

        context.res = {
            status: 200,
            body: { message: `Timesheet saved for user '${targetEmail}' successfully.` }
        };
    } catch (err) {
        context.log.error("Error saving timesheet for user:", err);
        if (err.details && err.details.error && err.details.error.code) {
            context.res = { status: 500, body: `Transaction error: ${err.details.error.code} - ${err.details.error.message}` };
        } else {
            context.res = { status: 500, body: `Error: ${err.message}` };
        }
    }
};
```

**`api/GetAllUsersTimesheets/index.js`:**

Changes:
- Import `getUserEmail`
- Auth uses `userEmail`
- Query param: `userId` → `userEmail`
- Response: user grouping key is email (from partitionKey), display name lookup uses email
- Drop `userId` from response, use `userEmail` field

Full updated file:
```js
const { createTableClient, getUserInfo, getUserEmail, isAdmin, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetAllUsersTimesheets function processing request.');

    const tableClient = createTableClient("engtime");

    const clientPrincipal = getUserInfo(req);
    const userEmail = getUserEmail(clientPrincipal);

    if (!clientPrincipal || !userEmail) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    if (!isAllowedDomain(clientPrincipal)) {
        context.res = { status: 403, body: "Access restricted to energyrecovery.com accounts." };
        return;
    }

    await ensureUser(req);

    const adminStatus = await isAdmin(userEmail);
    if (!adminStatus) {
        context.res = { status: 403, body: "Admin access required." };
        return;
    }

    // Optional filter by userEmail
    const filterUserEmail = req.query.userEmail;

    try {
        const results = {};
        const queryOptions = {};

        if (filterUserEmail) {
            queryOptions.filter = `PartitionKey eq '${filterUserEmail.toLowerCase()}'`;
        }

        const entities = tableClient.listEntities({ queryOptions });

        for await (const entity of entities) {
            const email = entity.partitionKey;
            const weekKey = entity.week;
            if (!weekKey) continue;

            if (!results[email]) {
                results[email] = {
                    userEmail: email,
                    weeks: {}
                };
            }

            if (!results[email].weeks[weekKey]) {
                results[email].weeks[weekKey] = [];
            }

            results[email].weeks[weekKey].push({
                projectId: entity.projectId,
                projectName: entity.projectName || '',
                percentage: entity.percentage,
                hours: entity.hours
            });
        }

        // Look up display names from users table
        const usersClient = createTableClient("users");
        const userDisplayNames = {};
        const userEntities = usersClient.listEntities({
            queryOptions: { filter: "PartitionKey eq 'users'" }
        });
        for await (const userEntity of userEntities) {
            userDisplayNames[userEntity.rowKey] = userEntity.displayName || '';
        }

        // Convert to array and enrich with display names
        const usersArray = Object.values(results).map(user => ({
            ...user,
            displayName: userDisplayNames[user.userEmail] || ''
        }));

        context.res = { status: 200, body: usersArray };
    } catch (err) {
        context.log.error("Error fetching all users timesheets:", err);
        context.res = { status: 500, body: `Error fetching timesheets: ${err.message}` };
    }
};
```

**`api/GetUsers/index.js`:**

Changes:
- Import `getUserEmail`
- Auth uses `userEmail`
- Response: drop `userId` field, `email` is the primary identifier (from `rowKey`)

Full updated file:
```js
const { createTableClient, getUserInfo, getUserEmail, isAdmin, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetUsers function processing request.');

    const clientPrincipal = getUserInfo(req);
    const userEmail = getUserEmail(clientPrincipal);

    if (!clientPrincipal || !userEmail) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    if (!isAllowedDomain(clientPrincipal)) {
        context.res = { status: 403, body: "Access restricted to energyrecovery.com accounts." };
        return;
    }

    await ensureUser(req);

    const adminStatus = await isAdmin(userEmail);
    if (!adminStatus) {
        context.res = { status: 403, body: "Admin access required." };
        return;
    }

    try {
        const usersClient = createTableClient("users");
        const users = [];
        const entities = usersClient.listEntities({
            queryOptions: { filter: "PartitionKey eq 'users'" }
        });

        for await (const entity of entities) {
            users.push({
                email: entity.rowKey,
                displayName: entity.displayName || '',
                isAdmin: entity.isAdmin === true,
                defaultInputMode: entity.defaultInputMode || 'percent',
                firstSeen: entity.firstSeen || '',
                lastSeen: entity.lastSeen || ''
            });
        }

        context.res = { status: 200, body: users };
    } catch (err) {
        context.log.error("Error fetching users:", err);
        context.res = { status: 500, body: `Error fetching users: ${err.message}` };
    }
};
```

**Step 1: Apply all four file changes**

Replace each file with the updated version above.

**Step 2: Commit**

```bash
git add api/UpdateUser/index.js api/SaveTimeAllocationForUser/index.js api/GetAllUsersTimesheets/index.js api/GetUsers/index.js
git commit -m "feat: switch admin target API functions to email-based identity"
```

---

### Task 7: Update audit-only functions

**Files:**
- Modify: `api/UpdateProject/index.js`
- Modify: `api/SaveProjectBudget/index.js`

**Context:** These functions only use userId in audit trail fields (`updatedBy`, `createdBy`). The auth pattern also needs updating.

**`api/UpdateProject/index.js`:**
- Line 1: add `getUserEmail` to imports
- After line 8: add `const userEmail = getUserEmail(clientPrincipal);`
- Line 9: change null-check to `!userEmail`
- Line 21: `isAdmin(userEmail)`
- Line 42: `updatedBy: userEmail`
- Line 63: `createdBy: userEmail`

**`api/SaveProjectBudget/index.js`:**
- Line 1: add `getUserEmail` to imports
- After line 8: add `const userEmail = getUserEmail(clientPrincipal);`
- Line 9: change null-check to `!userEmail`
- Line 14: `isAdmin(userEmail)`
- Line 34: `updatedBy: userEmail`

**Step 1: Apply both changes**

**Step 2: Commit**

```bash
git add api/UpdateProject/index.js api/SaveProjectBudget/index.js
git commit -m "feat: switch audit trail fields to email-based identity"
```

---

### Task 8: Delete unused admin endpoints

**Files:**
- Delete: `api/GetAdmins/index.js`
- Delete: `api/GetAdmins/function.json`
- Delete: `api/UpdateAdmins/index.js`
- Delete: `api/UpdateAdmins/function.json`

**Step 1: Delete the directories**

```bash
rm -rf api/GetAdmins api/UpdateAdmins
```

**Step 2: Commit**

```bash
git add -A api/GetAdmins api/UpdateAdmins
git commit -m "feat: remove unused GetAdmins and UpdateAdmins endpoints (admins table deprecated)"
```

---

### Task 9: Update admin.js frontend

**Files:**
- Modify: `admin.js`

**Context:** The admin frontend needs to match the API changes. Key changes:
1. User dropdown values use `user.email` instead of `user.userId`
2. Toggle admin sends `userEmail` instead of `userId` in request body
3. GetAllUsersTimesheets query param is `userEmail` instead of `userId`
4. SaveTimeAllocationForUser body uses `targetUserEmail` instead of `targetUserId`
5. Data matching uses `userEmail` instead of `userId`

**Changes (by line number):**

**Line 1031** — sort fallback:
```
(a.displayName || a.email || a.userId)  →  (a.displayName || a.email)
```
(Same for `b`)

**Line 1041** — name display:
```
user.displayName || user.email || user.userId  →  user.displayName || user.email
```

**Line 1052** — email display:
```
user.email || user.userId  →  user.email
```

**Line 1074** — toggle admin body:
```
body: JSON.stringify({ action: 'toggleAdmin', userId: user.userId })
→
body: JSON.stringify({ action: 'toggleAdmin', userEmail: user.email })
```

**Line 1137** — timesheets tab sort fallback:
```
(a.displayName || a.email || a.userId)  →  (a.displayName || a.email)
```

**Line 1160** — dropdown option value:
```
opt.value = user.userId  →  opt.value = user.email
```

**Lines 1161-1163** — dropdown option text:
```
opt.textContent = user.displayName
  ? user.displayName + ' (' + (user.email || user.userId) + ')'
  : (user.email || user.userId);
→
opt.textContent = user.displayName
  ? user.displayName + ' (' + user.email + ')'
  : user.email;
```

**Line 1184** — loadUserData parameter name (cosmetic, `userId` → `userEmail`):
```
async function loadUserData(userId) {  →  async function loadUserData(userEmail) {
```

**Line 1192** — API call query param:
```
'/api/GetAllUsersTimesheets?userId=' + encodeURIComponent(userId)
→
'/api/GetAllUsersTimesheets?userEmail=' + encodeURIComponent(userEmail)
```

**Line 1195** — data matching:
```
data.find(u => u.userId === userId) || { userId, userEmail: '', weeks: {} }
→
data.find(u => u.userEmail === userEmail) || { userEmail, weeks: {} }
```

**Line 1197** — fallback:
```
{ userId: select.value, userEmail: '', weeks: {} }
→
{ userEmail: select.value, weeks: {} }
```

**Line 1432** — save body:
```
targetUserId: userSelect.value  →  targetUserEmail: userSelect.value
```

**Step 1: Apply all admin.js changes**

Apply each edit listed above.

**Step 2: Commit**

```bash
git add admin.js
git commit -m "feat: switch admin.js to email-based user identification"
```

---

### Task 10: Update index.js frontend

**Files:**
- Modify: `index.js:2243`

**Step 1: Change the fallback display**

Line 2243, change:
```js
let baseUsername = userInfo.userId; // Fallback to userId
```
To:
```js
let baseUsername = userInfo.userDetails || ''; // Fallback to email
```

**Step 2: Commit**

```bash
git add index.js
git commit -m "feat: switch index.js fallback display from userId to userDetails"
```

---

### Task 11: Update server.js mock data

**Files:**
- Modify: `server.js`

**Context:** The local dev server needs mock data that matches the new API response shapes.

**Changes:**

1. **GetUsers mock** (lines 35-38): Remove `userId` fields, keep `email` as primary identifier:
```js
'/api/GetUsers': [
    { email: 'atheodossiou@energyrecovery.com', displayName: 'Alexandros Theodossiou', isAdmin: true, defaultInputMode: 'percent', firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString() },
    { email: 'jsmith@energyrecovery.com', displayName: 'John Smith', isAdmin: false, defaultInputMode: 'percent', firstSeen: '2025-06-01T00:00:00Z', lastSeen: '2026-02-10T00:00:00Z' },
    { email: 'klee@energyrecovery.com', displayName: 'Karen Lee', isAdmin: false, defaultInputMode: 'hours', firstSeen: '2025-08-15T00:00:00Z', lastSeen: '2026-02-12T00:00:00Z' }
],
```

2. **GetAllUsersTimesheets mock** (lines 69-96): Replace `userId` with `userEmail`:
```js
'/api/GetAllUsersTimesheets': [
    {
      userEmail: 'atheodossiou@energyrecovery.com',
      displayName: 'Alexandros Theodossiou',
      weeks: { ... }  // keep existing week data unchanged
    },
    {
      userEmail: 'jsmith@energyrecovery.com',
      displayName: 'John Smith',
      weeks: { ... }  // keep existing week data unchanged
    }
],
```

3. **Filter logic** (lines 148-152): Change from `userId` to `userEmail`:
```js
// Filter GetAllUsersTimesheets by userEmail if provided
if (urlPath === '/api/GetAllUsersTimesheets' && params.get('userEmail')) {
    const filterEmail = params.get('userEmail');
    data = data.filter(u => u.userEmail === filterEmail);
}
```

**Step 1: Apply server.js changes**

**Step 2: Commit**

```bash
git add server.js
git commit -m "feat: update server.js mock data for email-based identity"
```

---

### Task 12: Local verification

**Step 1: Start the dev server**

```bash
npm start
```

Expected: Server starts on port 8080.

**Step 2: Open in browser and verify**

Navigate to `http://localhost:8080`. Verify:
- App loads without console errors
- User name displays correctly (from mock auth)
- Navigate to Admin Console
- Users tab shows users (from mock GetUsers — should show email, not userId)
- User Timesheets tab: dropdown shows users by email, selecting loads timesheets

**Step 3: Stop dev server**

---

### Task 13: Final commit and deploy

**Step 1: Verify all changes are committed**

```bash
git status
git log --oneline -10
```

Expected: Clean working tree, commits from Tasks 1-11 visible.

**Step 2: Push to trigger deployment**

Push to `main` branch to trigger the Azure Static Web Apps GitHub Actions workflow.

---

## Post-Deploy Verification Checklist

After Phase 1 deploy:
- [ ] Call `GET /api/MigrateToEmail` — check success counts
- [ ] Spot-check Azure Table Storage for email-keyed records

After Phase 2 deploy:
- [ ] Login — verify old timesheets appear under your email
- [ ] Save a new timesheet — verify email-keyed PartitionKey in Table Storage
- [ ] Admin Console: user list shows correctly
- [ ] Admin Console: toggle admin for another user works
- [ ] Admin Console: view/edit another user's timesheets works
- [ ] Check Power Automate flow triggers successfully (Teams notification fires)

## Rollback

Old userId-keyed records are preserved (not deleted). If issues arise:
1. Revert the Phase 2 commits
2. Push to main → redeploy
3. Old userId-keyed records still work with the reverted code
