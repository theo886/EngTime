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
