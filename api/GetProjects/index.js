const { createTableClient } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetProjects function processing request.');

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
                code: entity.code || '',
                color: entity.color || '#808080',
                isActive: entity.isActive !== false,
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
