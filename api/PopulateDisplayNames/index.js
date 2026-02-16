const axios = require("axios");
const { createTableClient, getUserInfo, isAdmin, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('PopulateDisplayNames function processing request.');

    const clientPrincipal = getUserInfo(req);
    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    if (!isAllowedDomain(clientPrincipal)) {
        context.res = { status: 403, body: "Access restricted to energyrecovery.com accounts." };
        return;
    }

    await ensureUser(req);

    const adminStatus = await isAdmin(clientPrincipal.userId);
    if (!adminStatus) {
        context.res = { status: 403, body: "Admin access required." };
        return;
    }

    // Check required environment variables
    const tenantId = process.env.GRAPH_TENANT_ID;
    const clientId = process.env.GRAPH_CLIENT_ID;
    const clientSecret = process.env.GRAPH_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
        context.res = {
            status: 500,
            body: "Graph API not configured. Set GRAPH_TENANT_ID, GRAPH_CLIENT_ID, and GRAPH_CLIENT_SECRET environment variables in Azure."
        };
        return;
    }

    try {
        // Step 1: Get all users from users table
        const usersClient = createTableClient("users");
        const users = [];
        const entities = usersClient.listEntities({
            queryOptions: { filter: "PartitionKey eq 'users'" }
        });
        for await (const entity of entities) {
            users.push({
                userId: entity.rowKey,
                email: entity.email || '',
                displayName: entity.displayName || ''
            });
        }

        // Step 2: Get Graph API access token using client credentials
        const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const tokenResponse = await axios.post(tokenUrl, new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'https://graph.microsoft.com/.default'
        }).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        // Step 3: Look up display names for users missing them
        let populated = 0;
        let skipped = 0;
        let failed = 0;
        const errors = [];

        for (const user of users) {
            if (user.displayName) {
                skipped++;
                continue;
            }

            if (!user.email) {
                skipped++;
                continue;
            }

            try {
                const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(user.email)}?$select=displayName`;
                const graphResponse = await axios.get(graphUrl, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });

                const displayName = graphResponse.data.displayName;
                if (displayName) {
                    await usersClient.upsertEntity({
                        partitionKey: "users",
                        rowKey: user.userId,
                        displayName: displayName
                    }, "Merge");
                    populated++;
                } else {
                    skipped++;
                }
            } catch (err) {
                failed++;
                const status = err.response?.status || 'unknown';
                errors.push(`${user.email}: ${status}`);
                context.log.warn(`Failed to look up ${user.email}: ${status}`);
            }
        }

        context.res = {
            status: 200,
            body: {
                success: true,
                total: users.length,
                populated,
                skipped,
                failed,
                errors: errors.slice(0, 10)
            }
        };
    } catch (err) {
        context.log.error("Error populating display names:", err);
        const message = err.response?.data?.error_description || err.message;
        context.res = { status: 500, body: `Error populating display names: ${message}` };
    }
};
