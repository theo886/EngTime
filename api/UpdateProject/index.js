const { createTableClient, getUserInfo, isAdmin } = require("../shared/tableClient");

const tableClient = createTableClient("projects");

module.exports = async function (context, req) {
    context.log('UpdateProject function processing request.');

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

    const { projectId, name, code, color, isActive } = req.body || {};

    if (!projectId || !name || !code) {
        context.res = { status: 400, body: "Missing required fields: 'projectId', 'name', 'code'." };
        return;
    }

    try {
        const entity = {
            partitionKey: "projects",
            rowKey: projectId,
            name: name,
            code: code,
            color: color || '#808080',
            isActive: isActive !== false, // defaults to true
            updatedAt: new Date(),
            updatedBy: clientPrincipal.userId
        };

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
