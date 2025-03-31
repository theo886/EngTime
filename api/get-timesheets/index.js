const sql = require('mssql');

module.exports = async function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request for get-timesheets.');

    const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;

    if (!connectionString) {
        context.res = {
            status: 500,
            body: "Database connection string is missing."
        };
        return;
    }

    try {
        await sql.connect(connectionString);
        // TODO: Update query based on actual table structure and filtering needs
        const result = await sql.query`SELECT * FROM Timesheets`; // Assuming a table named 'Timesheets'
        context.res = {
            // status: 200, /* Defaults to 200 */
            body: result.recordset
        };
    } catch (err) {
        context.log.error('Error executing SQL query:', err);
        context.res = {
            status: 500,
            body: "Error retrieving data from database."
        };
    } finally {
        await sql.close();
    }
}; 