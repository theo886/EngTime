const { createTableClient, getUserInfo, isAdmin, ensureUser } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetUsers function processing request.');

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

    try {
        const usersClient = createTableClient("users");
        const users = [];
        const entities = usersClient.listEntities({
            queryOptions: { filter: "PartitionKey eq 'users'" }
        });

        for await (const entity of entities) {
            users.push({
                userId: entity.rowKey,
                email: entity.email || '',
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
