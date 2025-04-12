const { TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");

// --- Authentication ---
// Use Managed Identity ONLY (Recommended for Azure deployment)
const accountName = "engtimetable";
const tableName = "engtime";
const credential = new DefaultAzureCredential();
const tableClient = new TableClient(`https://${accountName}.table.core.windows.net`, tableName, credential);
// --- End Authentication ---


function getUserInfo(req) {
    const header = req.headers['x-ms-client-principal'];
    if (!header) return null;
    const encoded = Buffer.from(header, 'base64');
    const decoded = encoded.toString('ascii');
    try {
        return JSON.parse(decoded);
    } catch (e) {
        console.error("Error parsing client principal header:", e);
        return null;
    }
}

module.exports = async function (context, req) {
    context.log('GetAllTimeAllocations function processing request.');

    const clientPrincipal = getUserInfo(req);

    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    const userId = clientPrincipal.userId;

    if (!tableClient) {
         context.res = { status: 500, body: "Table Storage client not initialized." };
         return;
    }

    try {
        const resultsByWeek = {};
        const entities = tableClient.listEntities({
            queryOptions: { filter: `PartitionKey eq '${userId}'` }
        });

        for await (const entity of entities) {
            // Assuming entity properties match our defined schema
            const weekKey = entity.week; // Use stored 'week' property
            if (!weekKey) {
                context.log.warn(`Entity missing 'week' property: PartitionKey=${entity.partitionKey}, RowKey=${entity.rowKey}`);
                continue; // Skip entities without a week property
            }

            if (!resultsByWeek[weekKey]) {
                resultsByWeek[weekKey] = [];
            }
            resultsByWeek[weekKey].push({
                // Map Table Storage entity properties back to format expected by frontend cache
                ProjectId: entity.projectId,   // Assuming property name is 'projectId'
                Percentage: entity.percentage // Assuming property name is 'percentage'
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