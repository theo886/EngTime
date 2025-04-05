const sql = require('mssql');

// Helper function to get user info from header
function getUserInfo(req) {
    const header = req.headers['x-ms-client-principal'];
    if (!header) {
        return null;
    }
    const encoded = Buffer.from(header, 'base64');
    const decoded = encoded.toString('ascii');
    return JSON.parse(decoded);
}

module.exports = async function (context, req) {
    context.log('GetTimeAllocations function processing request.');

    const clientPrincipal = getUserInfo(req);

    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    const userId = clientPrincipal.userId;
    const week = req.query.week; // Expecting week as query parameter, e.g., /api/GetTimeAllocations?week=MM/DD/YYYY%20-%20MM/DD/YYYY

    if (!week) {
        context.res = { status: 400, body: "Missing 'week' query parameter." };
        return;
    }

    const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;
    if (!connectionString) {
        context.res = { status: 500, body: "Database connection string is not configured." };
        return;
    }

    let pool;
    try {
        pool = await sql.connect(connectionString);
        // TODO: Replace TimeAllocations with actual table name and column names if different
        const result = await pool.request()
                               .input('UserId', sql.NVarChar, userId)
                               .input('Week', sql.NVarChar, week)
                               .query('SELECT ProjectId, Percentage FROM TimeAllocations WHERE UserId = @UserId AND Week = @Week');

        // Return the found entries or an empty array if none found
        context.res = {
            status: 200,
            body: result.recordset // recordset is an array, empty if no rows found
        };

    } catch (err) {
        context.log.error("Database Query Error:", err);
        context.res = { status: 500, body: `Database error: ${err.message}` };
    } finally {
        if (pool) {
             try {
                await pool.close(); // Use the pool variable defined earlier
            } catch (closeErr) {
                 context.log.error("Error closing connection:", closeErr);
            }
        }
    }
};