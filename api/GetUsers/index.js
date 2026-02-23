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
