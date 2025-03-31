const sql = require('mssql');

module.exports = async function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request for add-timesheet.');

    const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;

    if (!connectionString) {
        context.res = {
            status: 500,
            body: "Database connection string is missing."
        };
        return;
    }

    // TODO: Add validation for request body fields
    const { weekStartDate, projectId, percentage } = req.body;

    if (!weekStartDate || !projectId || percentage === undefined) {
        context.res = {
            status: 400,
            body: "Please pass weekStartDate, projectId, and percentage in the request body"
        };
        return;
    }

    try {
        await sql.connect(connectionString);
        // TODO: Update query based on actual table structure
        // Example: Assuming 'Timesheets' table with columns WeekStartDate, ProjectID, Percentage
        const result = await sql.query`
            INSERT INTO Timesheets (WeekStartDate, ProjectID, Percentage)
            VALUES (${weekStartDate}, ${projectId}, ${percentage})
        `;
        context.res = {
            status: 201, // Created
            body: { message: "Timesheet entry added successfully.", /* optional: result */ }
        };
    } catch (err) {
        context.log.error('Error executing SQL query:', err);
        context.res = {
            status: 500,
            body: "Error adding data to the database."
        };
    } finally {
        await sql.close();
    }
}; 