const { createTableClient, getUserInfo, isAdmin } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetAdmins function processing request.');

    const adminsClient = createTableClient("admins");

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

    try {
        const admins = [];
        const entities = adminsClient.listEntities({
            queryOptions: { filter: "PartitionKey eq 'admins'" }
        });

        for await (const entity of entities) {
            admins.push({
                userId: entity.rowKey,
                userEmail: entity.userEmail || '',
                addedBy: entity.addedBy || '',
                addedAt: entity.addedAt || ''
            });
        }

        context.res = { status: 200, body: admins };
    } catch (err) {
        context.log.error("Error fetching admins:", err);
        context.res = { status: 500, body: `Error fetching admins: ${err.message}` };
    }
};
