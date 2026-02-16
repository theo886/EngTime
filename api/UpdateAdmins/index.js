const { createTableClient, getUserInfo, isAdmin } = require("../shared/tableClient");

const adminsClient = createTableClient("admins");

module.exports = async function (context, req) {
    context.log('UpdateAdmins function processing request.');

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

    const { action, userId, userEmail } = req.body || {};

    if (!action || !userId) {
        context.res = { status: 400, body: "Missing required fields: 'action' and 'userId'." };
        return;
    }

    try {
        if (action === 'add') {
            const entity = {
                partitionKey: "admins",
                rowKey: userId,
                userEmail: userEmail || '',
                addedBy: clientPrincipal.userId,
                addedAt: new Date()
            };
            await adminsClient.upsertEntity(entity, "Replace");
            context.res = { status: 200, body: { message: `Admin '${userId}' added successfully.` } };

        } else if (action === 'remove') {
            // Prevent removing yourself
            if (userId === clientPrincipal.userId) {
                context.res = { status: 400, body: "Cannot remove yourself as admin." };
                return;
            }
            await adminsClient.deleteEntity("admins", userId);
            context.res = { status: 200, body: { message: `Admin '${userId}' removed successfully.` } };

        } else {
            context.res = { status: 400, body: "Invalid action. Use 'add' or 'remove'." };
        }
    } catch (err) {
        context.log.error("Error updating admins:", err);
        context.res = { status: 500, body: `Error updating admins: ${err.message}` };
    }
};
