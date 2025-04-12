const { TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity"); // Use Managed Identity

// --- Authentication ---
// Use Managed Identity (Recommended for Azure deployment)
const accountName = "engtimetable"; // Your storage account name
const tableName = "engtime"; // Your table name
const credential = new DefaultAzureCredential();
const tableClient = new TableClient(`https://${accountName}.table.core.windows.net`, tableName, credential);

/* // Option 1: Use Connection String (Less secure for deployed apps)
const connectionString = process.env.AZURE_TABLE_STORAGE_CONNECTION_STRING;
const tableName = "engtime"; // Your table name
let tableClient;
if (connectionString) {
    // ... (parsing logic remains the same but is now commented out)
    const { AzureNamedKeyCredential } = require("@azure/data-tables"); // Need this if using connection string
    // ...
} else {
     throw new Error("Azure Table Storage connection string not configured AND Managed Identity failed.");
}
*/
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