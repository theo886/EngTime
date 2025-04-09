const sql = require('mssql');
const axios = require('axios');

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

    // --- NEW: Generate submission timestamp ---
    const dateSubmitted = new Date(); 
    // --- END NEW ---

    if (!week || !userEmail || !Array.isArray(entries)) {
        context.res = { status: 400, body: "Invalid request body. Expecting 'week', 'userEmail', and 'entries' array." };
        return;
    }

    // Read the connection string injected by the SWA Database Connection feature
    const connectionString = process.env.AZURE_SQL_CONNECTION_STRING_SqlDb; // Note the suffix matching the connection name
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

            // --- MODIFIED: Insert new entries with calculated Hours and dateSubmitted ---
            for (const entry of entries) {
                if (entry.projectId && entry.percentage != null) { // Ensure required data exists
                    const percentage = parseInt(entry.percentage);
                    const hours = parseFloat((percentage * 0.4).toFixed(1)); // Calculate hours (e.g., 13.2)
                    
                    const insertRequest = transaction.request();
                    await insertRequest.input('UserId', sql.NVarChar, userId)
                                       .input('Week', sql.NVarChar, week)
                                       .input('ProjectId', sql.NVarChar, entry.projectId) // Adjust type/length if needed
                                       .input('Percentage', sql.Int, percentage) // Ensure percentage is stored as int
                                       .input('UserEmail', sql.NVarChar, userEmail) // Assumes NVARCHAR column
                                       .input('Hours', sql.Decimal(4, 1), hours) // Add Hours, ensure type matches DB
                                       .input('DateSubmitted', sql.DateTime2, dateSubmitted) // Add DateSubmitted, ensure type matches DB
                                       .query('INSERT INTO TimeAllocations (UserId, Week, ProjectId, Percentage, UserEmail, Hours, DateSubmitted) VALUES (@UserId, @Week, @ProjectId, @Percentage, @UserEmail, @Hours, @DateSubmitted)'); // TODO: Replace TimeAllocations with actual table name, ADD new columns
                }
            }
            // --- END MODIFIED ---

            await transaction.commit(); // Commit transaction if all inserts succeed

            context.log('Database commit successful. Attempting to trigger Excel update flow.');

            // Get the Power Automate URL from environment variables
            const powerAutomateUrl = process.env.POWER_AUTOMATE_SAVE_URL;

            if (powerAutomateUrl) {
                // --- MODIFIED: Prepare payload for Power Automate with new fields ---
                const entriesWithHours = entries.map(entry => ({
                    ...entry,
                    hours: parseFloat(((parseInt(entry.percentage) || 0) * 0.4).toFixed(1)) // Calculate hours again for payload
                }));

                const excelPayload = {
                    userId: userId, // Already have this from clientPrincipal
                    userEmail: clientPrincipal.userDetails, // Assuming userDetails is the email
                    week: week, // Already have this from request body
                    dateSubmitted: dateSubmitted.toISOString(), // Send as ISO string
                    entries: entriesWithHours // Send entries array with calculated hours
                };
                // --- END MODIFIED ---

                try {
                    // Make POST request to Power Automate - run asynchronously without await
                    // We don't want the function to wait for Excel update to respond to the client
                    axios.post(powerAutomateUrl, excelPayload)
                        .then(response => {
                            context.log(`Successfully triggered Excel update flow. Status: ${response.status}`);
                        })
                        .catch(paError => {
                            // Log error but don't fail the main function execution
                            context.log.error('Error triggering Power Automate flow:', paError.message);
                            if (paError.response) {
                                context.log.error('Power Automate Error Response:', paError.response.data);
                            }
                        });

                } catch (paTriggerError) {
                    // Catch potential synchronous errors during the axios call setup
                     context.log.error('Synchronous error setting up Power Automate trigger:', paTriggerError.message);
                }

            } else {
                context.log.warn('POWER_AUTOMATE_SAVE_URL environment variable not set. Skipping Excel update.');
            }
            
            // Set the success response for the original HTTP trigger AFTER initiating the async call
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