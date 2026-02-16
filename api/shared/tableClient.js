const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

const accountName = "engtimetable";
const connectionString = process.env.AZURE_TABLE_STORAGE_CONNECTION_STRING;

/**
 * Creates a TableClient for the given table name.
 * Uses connection string if available, otherwise falls back to Managed Identity.
 */
function createTableClient(tableName) {
    if (connectionString) {
        const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/);
        if (!accountKeyMatch) {
            throw new Error("Could not parse AccountKey from connection string.");
        }
        const accountKey = accountKeyMatch[1];
        const credential = new AzureNamedKeyCredential(accountName, accountKey);
        return new TableClient(`https://${accountName}.table.core.windows.net`, tableName, credential);
    } else {
        const { DefaultAzureCredential } = require("@azure/identity");
        const credential = new DefaultAzureCredential();
        return new TableClient(`https://${accountName}.table.core.windows.net`, tableName, credential);
    }
}

/**
 * Extracts user info from Azure SWA's x-ms-client-principal header.
 */
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

/**
 * Checks if the given userId is in the admins table.
 */
async function isAdmin(userId) {
    try {
        const adminsClient = createTableClient("admins");
        const entity = await adminsClient.getEntity("admins", userId);
        return !!entity;
    } catch (e) {
        // 404 means not an admin, any other error we treat as not admin
        return false;
    }
}

module.exports = { createTableClient, getUserInfo, isAdmin };
