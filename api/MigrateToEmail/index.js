const { createTableClient, getUserInfo, getUserEmail, isAdmin, isAllowedDomain, ensureUser } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('MigrateToEmail function processing request.');

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
