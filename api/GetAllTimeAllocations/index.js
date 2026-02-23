const { createTableClient, getUserInfo, getUserEmail, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetAllTimeAllocations function processing request.');

    const tableClient = createTableClient("engtime");

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
        const resultsByWeek = {};
        const entities = tableClient.listEntities({
            queryOptions: { filter: `PartitionKey eq '${userEmail}'` }
        });

        for await (const entity of entities) {
            const weekKey = entity.week;
            if (!weekKey) {
                context.log.warn(`Entity missing 'week' property: PartitionKey=${entity.partitionKey}, RowKey=${entity.rowKey}`);
                continue;
            }

            if (!resultsByWeek[weekKey]) {
                resultsByWeek[weekKey] = [];
            }
            resultsByWeek[weekKey].push({
                ProjectId: entity.projectId,
                Percentage: entity.percentage
            });
        }

        context.res = {
            status: 200,
            body: resultsByWeek
        };

    } catch (err) {
        context.log.error("Table Storage Query Error:", err);
        context.res = { status: 500, body: `Table Storage error: ${err.message}` };
    }
};
