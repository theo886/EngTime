const { createTableClient, getUserInfo, isAdmin, ensureUser } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('UpdateProject function processing request.');

    const tableClient = createTableClient("projects");

    const clientPrincipal = getUserInfo(req);
    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    await ensureUser(req);

    const adminStatus = await isAdmin(clientPrincipal.userId);
    if (!adminStatus) {
        context.res = { status: 403, body: "Admin access required." };
        return;
    }

    const { projectId, name, color, isActive, budgetQ1, budgetQ2, budgetQ3, budgetQ4 } = req.body || {};

    if (!projectId || !name) {
        context.res = { status: 400, body: "Missing required fields: 'projectId', 'name'." };
        return;
    }

    try {
        const entity = {
            partitionKey: "projects",
            rowKey: projectId,
            name: name,
            color: color || '#808080',
            isActive: isActive !== false, // defaults to true
            updatedAt: new Date(),
            updatedBy: clientPrincipal.userId
        };

        // Add budget fields if provided (FTE per quarter)
        if (budgetQ1 !== undefined) entity.budgetQ1 = Number(budgetQ1) || 0;
        if (budgetQ2 !== undefined) entity.budgetQ2 = Number(budgetQ2) || 0;
        if (budgetQ3 !== undefined) entity.budgetQ3 = Number(budgetQ3) || 0;
        if (budgetQ4 !== undefined) entity.budgetQ4 = Number(budgetQ4) || 0;

        // Check if this is a new project (add createdAt/createdBy)
        try {
            await tableClient.getEntity("projects", projectId);
            // Exists — update only
        } catch (e) {
            if (e.statusCode === 404) {
                entity.createdAt = new Date();
                entity.createdBy = clientPrincipal.userId;
            }
        }

        await tableClient.upsertEntity(entity, "Merge");

        context.res = {
            status: 200,
            body: { message: `Project '${projectId}' saved successfully.`, project: entity }
        };
    } catch (err) {
        context.log.error("Error updating project:", err);
        context.res = { status: 500, body: `Error updating project: ${err.message}` };
    }
};
