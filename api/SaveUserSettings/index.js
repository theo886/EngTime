const { createTableClient, getUserInfo, getUserEmail, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('SaveUserSettings function processing request.');

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

    const { defaultInputMode } = req.body || {};

    const validModes = ["percent", "hours"];
    if (!defaultInputMode || !validModes.includes(defaultInputMode)) {
        context.res = { status: 400, body: "Invalid request. 'defaultInputMode' must be 'percent' or 'hours'." };
        return;
    }

    try {
        const usersClient = createTableClient("users");
        const entity = {
            partitionKey: "users",
            rowKey: userEmail,
            defaultInputMode: defaultInputMode
        };

        await usersClient.upsertEntity(entity, "Merge");

        context.res = {
            status: 200,
            body: { message: "Settings saved successfully.", defaultInputMode }
        };
    } catch (err) {
        context.log.error("Error saving user settings:", err);
        context.res = { status: 500, body: `Error saving settings: ${err.message}` };
    }
};
