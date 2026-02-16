const { createTableClient, getUserInfo, isAdmin } = require("../shared/tableClient");

const tableClient = createTableClient("engtime");

module.exports = async function (context, req) {
    context.log('SaveTimeAllocationForUser function processing request.');

    const clientPrincipal = getUserInfo(req);
    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    const adminStatus = await isAdmin(clientPrincipal.userId);
    if (!adminStatus) {
        context.res = { status: 403, body: "Admin access required." };
        return;
    }

    const { targetUserId, targetUserEmail, week, WeekStartDate, entries } = req.body || {};

    if (!targetUserId || !week || !Array.isArray(entries)) {
        context.res = { status: 400, body: "Missing required fields: 'targetUserId', 'week', and 'entries' array." };
        return;
    }

    const dateSubmitted = new Date();

    try {
        // Step 1: Delete existing entries for target user and week
        const existingEntities = [];
        const entitiesToDelete = tableClient.listEntities({
            queryOptions: { filter: `PartitionKey eq '${targetUserId}' and week eq '${week}'` }
        });
        for await (const entity of entitiesToDelete) {
            existingEntities.push({ partitionKey: entity.partitionKey, rowKey: entity.rowKey });
        }

        if (existingEntities.length > 0) {
            const deleteBatch = existingEntities.map(entityMeta =>
                ["delete", { partitionKey: entityMeta.partitionKey, rowKey: entityMeta.rowKey }]
            );
            await tableClient.submitTransaction(deleteBatch);
            context.log(`Deleted ${deleteBatch.length} existing entries for user ${targetUserId}, week ${week}.`);
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
                partitionKey: targetUserId,
                rowKey: rowKey,
                userId: targetUserId,
                week: week,
                weekStartDate: WeekStartDate || week.split(' - ')[0],
                projectId: entry.projectId,
                projectName: entry.projectName || 'Unknown Project',
                percentage: percentage,
                userEmail: targetUserEmail || '',
                hours: hours,
                dateSubmitted: dateSubmitted,
                submittedBy: clientPrincipal.userId // Track who submitted on behalf
            };
            upsertBatch.push(["upsert", newEntity]);
        });

        if (upsertBatch.length > 0) {
            await tableClient.submitTransaction(upsertBatch);
            context.log(`Upserted ${upsertBatch.length} entries for user ${targetUserId}, week ${week}.`);
        }

        context.res = {
            status: 200,
            body: { message: `Timesheet saved for user '${targetUserId}' successfully.` }
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
