const { getUserInfo, getUserEmail, isAdmin, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('CheckAdmin function processing request.');

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

    try {
        const adminStatus = await isAdmin(userEmail);
        context.res = {
            status: 200,
            body: { isAdmin: adminStatus }
        };
    } catch (err) {
        context.log.error("Error checking admin status:", err);
        context.res = { status: 500, body: `Error checking admin status: ${err.message}` };
    }
};
