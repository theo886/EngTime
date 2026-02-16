const { createTableClient, getUserInfo, isAdmin } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetProjectBudgets function processing request.');

    const tableClient = createTableClient("projectbudgets");

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
        const budgets = [];
        const entities = tableClient.listEntities({
            queryOptions: { filter: "PartitionKey eq 'budgets'" }
        });

        for await (const entity of entities) {
            budgets.push({
                projectId: entity.rowKey,
                budgetHours: entity.budgetHours || 0,
                budgetPeriodStart: entity.budgetPeriodStart || '',
                budgetPeriodEnd: entity.budgetPeriodEnd || '',
                updatedBy: entity.updatedBy || '',
                updatedAt: entity.updatedAt || ''
            });
        }

        context.res = { status: 200, body: budgets };
    } catch (err) {
        context.log.error("Error fetching project budgets:", err);
        context.res = { status: 500, body: `Error fetching budgets: ${err.message}` };
    }
};
