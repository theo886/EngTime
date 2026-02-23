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
