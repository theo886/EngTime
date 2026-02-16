const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

const accountName = "engtimetable";
const connectionString = process.env.AZURE_TABLE_STORAGE_CONNECTION_STRING;

/**
 * Creates a TableClient for the given table name.
 * Uses connection string (always set in production via AZURE_TABLE_STORAGE_CONNECTION_STRING).
 */
function createTableClient(tableName) {
    if (!connectionString) {
        throw new Error("AZURE_TABLE_STORAGE_CONNECTION_STRING environment variable is not set.");
    }
    const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/);
    if (!accountKeyMatch) {
        throw new Error("Could not parse AccountKey from connection string.");
    }
    const accountKey = accountKeyMatch[1];
    const credential = new AzureNamedKeyCredential(accountName, accountKey);
    return new TableClient(`https://${accountName}.table.core.windows.net`, tableName, credential);
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
 * Checks if the given userId has isAdmin=true in the users table.
 */
async function isAdmin(userId) {
    try {
        const usersClient = createTableClient("users");
        const entity = await usersClient.getEntity("users", userId);
        return entity.isAdmin === true;
    } catch (e) {
        // 404 means user not found, treat as not admin
        return false;
    }
}

/**
 * Ensures a user record exists in the users table.
 * Creates on first login, updates lastSeen on subsequent requests.
 * Uses Merge mode so it won't overwrite isAdmin or defaultInputMode.
 */
async function ensureUser(req) {
    const clientPrincipal = getUserInfo(req);
    if (!clientPrincipal || !clientPrincipal.userId) return;

    try {
        const usersClient = createTableClient("users");
        const now = new Date();
        const entity = {
            partitionKey: "users",
            rowKey: clientPrincipal.userId,
            email: clientPrincipal.userDetails || "",
            lastSeen: now
        };

        // Check if user exists — if not, set firstSeen and defaults
        try {
            await usersClient.getEntity("users", clientPrincipal.userId);
        } catch (e) {
            if (e.statusCode === 404) {
                entity.firstSeen = now;
                entity.isAdmin = false;
                entity.defaultInputMode = "percent";
            }
        }

        await usersClient.upsertEntity(entity, "Merge");
    } catch (e) {
        // Non-fatal — don't block the request if user tracking fails
        console.error("ensureUser error:", e.message);
    }
}

module.exports = { createTableClient, getUserInfo, isAdmin, ensureUser };
