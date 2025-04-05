const sql = require('mssql');

// Helper function to get user info from header
function getUserInfo(req) {
    const header = req.headers['x-ms-client-principal'];
    if (!header) return null;
    const encoded = Buffer.from(header, 'base64');
    const decoded = encoded.toString('ascii');
    return JSON.parse(decoded);
}

module.exports = async function (context, req) {
    context.log('GetTimeAllocations function processing request to fetch ALL user data.');

    const clientPrincipal = getUserInfo(req);

    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    const userId = clientPrincipal.userId;

    const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;
    if (!connectionString) {
        context.res = { status: 500, body: "Database connection string is not configured." };
        return;
    }

    let pool;
    try {
        pool = await sql.connect(connectionString);
        // Fetch ALL records for the user, ordering might be useful but not essential for cache
        // TODO: Replace TimeAllocations and column names (Week, ProjectId, Percentage, UserId) if different
        const result = await pool.request()
                               .input('UserId', sql.NVarChar, userId) // TODO: Confirm UserId column name and type
                               .query('SELECT Week, ProjectId, Percentage FROM TimeAllocations WHERE UserId = @UserId'); // TODO: Replace TimeAllocations and confirm column names

        // Group results by week for easier consumption by the frontend cache
        const groupedData = {};
        result.recordset.forEach(row => {
            const weekKey = row.Week; // Assuming 'Week' column stores the "MM/DD/YYYY - MM/DD/YYYY" string
            if (!groupedData[weekKey]) {
                groupedData[weekKey] = [];
            }
            groupedData[weekKey].push({
                ProjectId: row.ProjectId,
                Percentage: row.Percentage // Keep as number from DB
            });
        });

        context.res = {
            status: 200,
            // Send the data grouped by week string
            body: groupedData
        };

    } catch (err) {
        context.log.error("Database Query Error:", err);
        context.res = { status: 500, body: `Database error: ${err.message}` };
    } finally {
        if (pool) {
             try { await pool.close(); context.log("SQL Connection closed."); }
             catch (closeErr) { context.log.error("Error closing SQL connection:", closeErr); }
        }
    }
};