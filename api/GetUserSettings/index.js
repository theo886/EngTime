const { createTableClient, getUserInfo } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetUserSettings function processing request.');

    const tableClient = createTableClient("usersettings");

    const clientPrincipal = getUserInfo(req);
    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    const userId = clientPrincipal.userId;

    try {
        const entity = await tableClient.getEntity("settings", userId);
        context.res = {
            status: 200,
            body: {
                defaultInputMode: entity.defaultInputMode || "percent",
            }
        };
    } catch (err) {
        if (err.statusCode === 404) {
            // No settings saved yet — return defaults
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
