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
    context.log('GetAllTimeAllocations function processing request.');

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
        // Fetch all records for the specific user
        // Ensure table/column names (UserId, Week, ProjectId, Percentage) match your DB
        const result = await pool.request()
                               .input('UserId', sql.NVarChar, userId)
                               .query('SELECT Week, ProjectId, Percentage FROM TimeAllocations WHERE UserId = @UserId ORDER BY Week, ProjectId'); // Order is good practice

        // Group results by week for easier frontend consumption
        const resultsByWeek = {};
        result.recordset.forEach(row => {
            const weekKey = row.Week; // Assuming 'Week' column stores the formatted week string directly
            if (!resultsByWeek[weekKey]) {
                resultsByWeek[weekKey] = [];
            }
            resultsByWeek[weekKey].push({
                // Only include necessary fields
                ProjectId: row.ProjectId,
                Percentage: row.Percentage
            });
        });

        context.res = {
            status: 200,
            // Send the data grouped by week
            body: resultsByWeek
        };

    } catch (err) {
        context.log.error("Database Query Error:", err);
        context.res = { status: 500, body: `Database error: ${err.message}` };
    } finally {
        if (pool) {
            try {
                await pool.close();
            } catch (closeErr) {
                context.log.error("Error closing connection:", closeErr);
            }
        }
    }
};