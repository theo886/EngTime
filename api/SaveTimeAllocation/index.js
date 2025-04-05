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
    context.log('SaveTimeAllocation function processing request.');

    const clientPrincipal = getUserInfo(req);

    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    const userId = clientPrincipal.userId; // Use this ID to associate data with the user
    const { week, userEmail, entries } = req.body; // Expecting { week: "MM/DD/YYYY - MM/DD/YYYY", userEmail: "...", entries: [{ projectId: "...", percentage: ... }] }

    if (!week || !userEmail || !Array.isArray(entries)) {
        context.res = { status: 400, body: "Invalid request body. Expecting 'week', 'userEmail', and 'entries' array." };
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
        const transaction = new sql.Transaction(pool); // Use a transaction
        await transaction.begin();

        try {
            // Delete existing entries for this user and week first
            const deleteRequest = transaction.request();
            await deleteRequest.input('UserId', sql.NVarChar, userId)
                               .input('Week', sql.NVarChar, week) // Ensure your DB column matches this type/length
                               .query('DELETE FROM TimeAllocations WHERE UserId = @UserId AND Week = @Week'); // TODO: Replace TimeAllocations with actual table name

            // Insert new entries
            for (const entry of entries) {
                if (entry.projectId && entry.percentage != null) { // Ensure required data exists
                    const insertRequest = transaction.request();
                    await insertRequest.input('UserId', sql.NVarChar, userId)
                                       .input('Week', sql.NVarChar, week)
                                       .input('ProjectId', sql.NVarChar, entry.projectId) // Adjust type/length if needed
                                       .input('Percentage', sql.Int, parseInt(entry.percentage)) // Ensure percentage is stored as int
                                       .input('UserEmail', sql.NVarChar, userEmail) // Assumes NVARCHAR column
                                       .query('INSERT INTO TimeAllocations (UserId, Week, ProjectId, Percentage, UserEmail) VALUES (@UserId, @Week, @ProjectId, @Percentage, @UserEmail)'); // TODO: Replace TimeAllocations with actual table name
                }
            }

            await transaction.commit(); // Commit transaction if all inserts succeed
            context.res = { status: 200, body: { message: "Timesheet saved successfully." } };

        } catch (err) {
            await transaction.rollback(); // Rollback on error
            context.log.error("Transaction Error:", err);
            context.res = { status: 500, body: `Database transaction error: ${err.message}` };
        }

    } catch (err) {
        context.log.error("Database Connection Error:", err);
        context.res = { status: 500, body: `Database connection error: ${err.message}` };
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