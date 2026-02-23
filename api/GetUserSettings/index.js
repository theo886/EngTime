const { createTableClient, getUserInfo, getUserEmail, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetUserSettings function processing request.');

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
        const usersClient = createTableClient("users");
        const entity = await usersClient.getEntity("users", userEmail);
        context.res = {
            status: 200,
            body: {
                defaultInputMode: entity.defaultInputMode || "percent",
            }
        };
    } catch (err) {
        if (err.statusCode === 404) {
            context.res = {
                status: 200,
                body: { defaultInputMode: "percent" }
            };
        } else {
            context.log.error("Error fetching user settings:", err);
            context.res = { status: 500, body: `Error fetching settings: ${err.message}` };
        }
    }
};
