const { createTableClient, getUserInfo, getUserEmail, isAdmin } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('SaveProjectBudget function processing request.');

    const tableClient = createTableClient("projectbudgets");

    const clientPrincipal = getUserInfo(req);
    const userEmail = getUserEmail(clientPrincipal);
    if (!clientPrincipal || !userEmail) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    const adminStatus = await isAdmin(userEmail);
    if (!adminStatus) {
        context.res = { status: 403, body: "Admin access required." };
        return;
    }

    const { projectId, budgetHours, budgetPeriodStart, budgetPeriodEnd } = req.body || {};

    if (!projectId || budgetHours === undefined) {
        context.res = { status: 400, body: "Missing required fields: 'projectId' and 'budgetHours'." };
        return;
    }

    try {
        const entity = {
            partitionKey: "budgets",
            rowKey: projectId,
            budgetHours: Number(budgetHours),
            budgetPeriodStart: budgetPeriodStart || '',
            budgetPeriodEnd: budgetPeriodEnd || '',
            updatedBy: userEmail,
            updatedAt: new Date()
        };

        await tableClient.upsertEntity(entity, "Replace");

        context.res = {
            status: 200,
            body: { message: `Budget for project '${projectId}' saved successfully.` }
        };
    } catch (err) {
        context.log.error("Error saving project budget:", err);
        context.res = { status: 500, body: `Error saving budget: ${err.message}` };
    }
};
