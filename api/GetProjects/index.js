const { createTableClient, getUserInfo, getUserEmail, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetProjects function processing request.');

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

    const tableClient = createTableClient("projects");

    // Optional query param to include inactive projects (for admin views)
    const includeInactive = req.query.includeInactive === 'true';

    try {
        const projects = [];
        const filter = includeInactive
            ? "PartitionKey eq 'projects'"
            : "PartitionKey eq 'projects' and isActive eq true";

        const entities = tableClient.listEntities({
            queryOptions: { filter }
        });

        for await (const entity of entities) {
            projects.push({
                id: entity.rowKey,
                name: entity.name || '',
                color: entity.color || '#808080',
                isActive: entity.isActive !== false,
                budgetQ1: entity.budgetQ1 || 0,
                budgetQ2: entity.budgetQ2 || 0,
                budgetQ3: entity.budgetQ3 || 0,
                budgetQ4: entity.budgetQ4 || 0,
                isDefault: entity.isDefault === true,
                defaultPercentage: entity.defaultPercentage || 0,
                createdAt: entity.createdAt || '',
                updatedAt: entity.updatedAt || ''
            });
        }

        context.res = { status: 200, body: projects };
    } catch (err) {
        context.log.error("Error fetching projects:", err);
        context.res = { status: 500, body: `Error fetching projects: ${err.message}` };
    }
};
