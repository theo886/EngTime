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
