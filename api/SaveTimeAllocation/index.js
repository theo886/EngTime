const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");
const axios = require('axios');

// --- Authentication ---
const accountName = "engtimetable";
const tableName = "engtime";

let tableClient;
const connectionString = process.env.AZURE_TABLE_STORAGE_CONNECTION_STRING;

if (connectionString) {
    console.log("Found AZURE_TABLE_STORAGE_CONNECTION_STRING, using Connection String for Table Storage.");
    // Parse connection string (simplified)
    const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/);
    if (!accountKeyMatch) {
        throw new Error("Could not parse AccountKey from connection string.");
    }
    const accountKey = accountKeyMatch[1];
    const credential = new AzureNamedKeyCredential(accountName, accountKey);
    tableClient = new TableClient(`https://${accountName}.table.core.windows.net`, tableName, credential);

} else {
    console.log("AZURE_TABLE_STORAGE_CONNECTION_STRING not found, attempting Managed Identity (DefaultAzureCredential).");
    // Fallback to Managed Identity
    const credential = new DefaultAzureCredential();
    tableClient = new TableClient(`https://${accountName}.table.core.windows.net`, tableName, credential);
}

// --- End Authentication ---

function getUserInfo(req) {
    const header = req.headers['x-ms-client-principal'];
    if (!header) return null;
    const encoded = Buffer.from(header, 'base64');
    const decoded = encoded.toString('ascii');
    try {
        return JSON.parse(decoded);
    } catch(e) {
        console.error("Error parsing client principal header:", e);
        return null;
    }
}

module.exports = async function (context, req) {
    context.log('SaveTimeAllocation function processing request.');

    const clientPrincipal = getUserInfo(req);

    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    const userId = clientPrincipal.userId;
    const { week, userEmail, WeekStartDate, entries } = req.body; // Expecting { week: "MM/DD/YYYY - MM/DD/YYYY", userEmail: "...", WeekStartDate: "...", entries: [{ projectId: "...", projectName: "...", percentage: ... }] }
    const dateSubmitted = new Date();

    if (!week || !userEmail || !Array.isArray(entries)) {
        context.res = { status: 400, body: "Invalid request body. Expecting 'week', 'userEmail', and 'entries' array." };
        return;
    }
     if (!tableClient) {
         context.res = { status: 500, body: "Table Storage client not initialized." };
         return;
    }

    try {
        // --- Step 1: Find existing entities for this user and week ---
        const existingEntities = [];
        const entitiesToDelete = tableClient.listEntities({
            queryOptions: { filter: `PartitionKey eq '${userId}' and week eq '${week}'` } // Use the 'week' property
        });
        for await (const entity of entitiesToDelete) {
            existingEntities.push({ partitionKey: entity.partitionKey, rowKey: entity.rowKey });
        }
        context.log(`Found ${existingEntities.length} existing entities for user ${userId}, week ${week}.`);

        // --- Step 2: Prepare batch operations (Delete old, Upsert new) ---
        const batch = [];

        // Add delete operations for existing entities
        existingEntities.forEach(entityMeta => {
            batch.push(["delete", { partitionKey: entityMeta.partitionKey, rowKey: entityMeta.rowKey }]);
        });

        // Add upsert operations for new/updated entries
        // Filter out entries without a project ID *before* processing
        const validEntries = entries.filter(entry => entry.projectId);

        validEntries.forEach(entry => {
            const percentage = parseInt(entry.percentage); // Already parsed by frontend
            const hours = parseFloat((percentage * 0.4).toFixed(1));
            // Revised SaveTimeAllocation RowKey: Use WeekStartDate (which should be just MM/DD/YYYY) instead of the full week string for the key part.
            const weekStartDateClean = (WeekStartDate || week.split(' - ')[0]).replace(/\//g, '-'); // Replace slashes
            const rowKey = `${weekStartDateClean}_${entry.projectId}`;

            const newEntity = {
                partitionKey: userId,
                rowKey: rowKey,
                userId: userId, // Store for convenience
                week: week,     // Store the FULL original week string here for grouping in GetAll
                weekStartDate: WeekStartDate || week.split(' - ')[0], // Store the start date too
                projectId: entry.projectId,
                projectName: entry.projectName || 'Unknown Project',
                percentage: percentage,
                userEmail: userEmail,
                hours: hours,
                dateSubmitted: dateSubmitted
            };
            batch.push(["upsert", newEntity]); // Upsert handles both insert and update
        });

         context.log(`Prepared batch with ${batch.length} operations.`);

        // --- Step 3: Submit the batch transaction ---
         if (batch.length > 0) {
            // Only submit if there are operations (either deletes or upserts or both)
             const response = await tableClient.submitTransaction(batch);
             context.log(`Batch transaction submitted. Status: ${response.status}`);
             // Optional: Check sub-responses within response.subResponses for individual operation status if needed
         } else {
             context.log("No changes detected, skipping batch submission.");
         }


        // --- Step 4: Trigger Power Automate (Keep existing logic) ---
        const powerAutomateUrl = process.env.POWER_AUTOMATE_SAVE_URL;
        if (powerAutomateUrl) {
             const entriesWithHours = validEntries.map(entry => { // Use validEntries here
                 const percentage = parseInt(entry.percentage);
                 const hours = parseFloat((percentage * 0.4).toFixed(1));
                 return {
                     projectId: entry.projectId,
                     projectName: entry.projectName || 'Unknown Project',
                     percentage: percentage,
                     hours: hours
                 };
             });
             const excelPayload = {
                 userId: userId,
                 userEmail: clientPrincipal.userDetails, // Assuming userDetails is the email
                 week: week,
                 weekStartDate: WeekStartDate || week.split(' - ')[0],
                 dateSubmitted: dateSubmitted.toISOString(),
                 entries: entriesWithHours
             };

             // Run async
             axios.post(powerAutomateUrl, excelPayload)
                 .then(response => {
                     context.log(`Successfully triggered Excel update flow. Status: ${response.status}`);
                 })
                 .catch(paError => {
                     context.log.error('Error triggering Power Automate flow:', paError.message);
                     if (paError.response) {
                         context.log.error('Power Automate Error Response:', paError.response.data);
                     }
                 });
        } else {
            context.log.warn('POWER_AUTOMATE_SAVE_URL environment variable not set. Skipping Excel update.');
        }

        context.res = { status: 200, body: { message: "Timesheet saved successfully." } };

    } catch (err) {
        context.log.error("Table Storage Save/Transaction Error:", err);
        // Provide more detail if it's a batch error
        if (err.details && err.details.error && err.details.error.code) {
             context.res = { status: 500, body: `Table Storage transaction error: ${err.details.error.code} - ${err.details.error.message}` };
        } else {
             context.res = { status: 500, body: `Table Storage error: ${err.message}` };
        }
    }
};