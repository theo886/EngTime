const { createTableClient, getUserInfo } = require("../shared/tableClient");

const tableClient = createTableClient("usersettings");

module.exports = async function (context, req) {
    context.log('SaveUserSettings function processing request.');

    const clientPrincipal = getUserInfo(req);
    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    const userId = clientPrincipal.userId;
    const { defaultInputMode } = req.body || {};

    // Validate
    const validModes = ["percent", "hours"];
    if (!defaultInputMode || !validModes.includes(defaultInputMode)) {
        context.res = { status: 400, body: "Invalid request. 'defaultInputMode' must be 'percent' or 'hours'." };
        return;
    }

    try {
        const entity = {
            partitionKey: "settings",
            rowKey: userId,
            defaultInputMode: defaultInputMode,
            updatedAt: new Date()
        };

        await tableClient.upsertEntity(entity, "Replace");

        context.res = {
            status: 200,
            body: { message: "Settings saved successfully.", defaultInputMode }
        };
    } catch (err) {
        context.log.error("Error saving user settings:", err);
        context.res = { status: 500, body: `Error saving settings: ${err.message}` };
    }
};
