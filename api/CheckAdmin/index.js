const { getUserInfo, isAdmin } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('CheckAdmin function processing request.');

    const clientPrincipal = getUserInfo(req);
    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    try {
        const adminStatus = await isAdmin(clientPrincipal.userId);
        context.res = {
            status: 200,
            body: { isAdmin: adminStatus }
        };
    } catch (err) {
        context.log.error("Error checking admin status:", err);
        context.res = { status: 500, body: `Error checking admin status: ${err.message}` };
    }
};
