const { createTableClient, getUserInfo, isAdmin, ensureUser } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetAllUsersTimesheets function processing request.');

    const tableClient = createTableClient("engtime");

    const clientPrincipal = getUserInfo(req);
    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    await ensureUser(req);

    const adminStatus = await isAdmin(clientPrincipal.userId);
    if (!adminStatus) {
        context.res = { status: 403, body: "Admin access required." };
        return;
    }

    // Optional filter by userId
    const filterUserId = req.query.userId;

    try {
        const results = {};
        const queryOptions = {};

        if (filterUserId) {
            queryOptions.filter = `PartitionKey eq '${filterUserId}'`;
        }

        const entities = tableClient.listEntities({ queryOptions });

        for await (const entity of entities) {
            const userId = entity.partitionKey;
            const weekKey = entity.week;
            if (!weekKey) continue;

            if (!results[userId]) {
                results[userId] = {
                    userId: userId,
                    userEmail: entity.userEmail || '',
                    weeks: {}
                };
            }

            // Update email if we find it (some entries may have it)
            if (entity.userEmail && !results[userId].userEmail) {
                results[userId].userEmail = entity.userEmail;
            }

            if (!results[userId].weeks[weekKey]) {
                results[userId].weeks[weekKey] = [];
            }

            results[userId].weeks[weekKey].push({
                projectId: entity.projectId,
                projectName: entity.projectName || '',
                percentage: entity.percentage,
                hours: entity.hours
            });
        }

        // Convert to array for easier consumption
        const usersArray = Object.values(results);

        context.res = { status: 200, body: usersArray };
    } catch (err) {
        context.log.error("Error fetching all users timesheets:", err);
        context.res = { status: 500, body: `Error fetching timesheets: ${err.message}` };
    }
};
