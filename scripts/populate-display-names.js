#!/usr/bin/env node
/**
 * One-time script to populate displayName for all users in Azure Table Storage
 * using a known email-to-name mapping.
 *
 * Usage:
 *   AZURE_TABLE_STORAGE_CONNECTION_STRING="..." node scripts/populate-display-names.js
 */

const path = require("path");
const apiNodeModules = path.join(__dirname, '..', 'api', 'node_modules');
const { TableClient, AzureNamedKeyCredential } = require(path.join(apiNodeModules, "@azure/data-tables"));

const connectionString = process.env.AZURE_TABLE_STORAGE_CONNECTION_STRING;
if (!connectionString) { console.error("Missing AZURE_TABLE_STORAGE_CONNECTION_STRING"); process.exit(1); }

const accountName = "engtimetable";
const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/);
if (!accountKeyMatch) { console.error("Could not parse AccountKey from connection string."); process.exit(1); }
const credential = new AzureNamedKeyCredential(accountName, accountKeyMatch[1]);
const usersClient = new TableClient(`https://${accountName}.table.core.windows.net`, "users", credential);

// Email → display name mapping (case-insensitive lookup)
const NAME_MAP = {
    'adeshmukh@energyrecovery.com': 'Arnav Deshmukh',
    'aremmel@energyrecovery.com': 'Adam Remmel',
    'athatte@energyrecovery.com': 'Azam Thatte',
    'czhang@og.energyrecovery.com': 'Chengyu Zhang',
    'htruax@energyrecovery.com': 'Hans Truax',
    'kbarabad@energyrecovery.com': 'Kat Barabad',
    'medke@energyrecovery.com': 'Mangesh Edke',
    'melhashimi@energyrecovery.com': 'Mohammed Elhashimi',
    'mpattom@energyrecovery.com': 'Matthew Pattom',
    'mquilici@energyrecovery.com': 'Matthew Quilici',
    'nsarawate@energyrecovery.com': 'Neelesh Sarawate',
    'sreddy@energyrecovery.com': 'Sujan Reddy',
    'swilkinson@og.energyrecovery.com': 'Scott Wilkinson',
    'ytan@energyrecovery.com': 'Yee Aun Tan',
    'aabdelaziz@og.energyrecovery.com': 'Ahmed Abdelaziz',
    'aphan@energyrecovery.com': 'Anthony Phan',
    'cdeshpande@energyrecovery.com': 'Chinmay Deshpande',
    'jmclean@energyrecovery.com': 'Jimmy McLean',
    'mdarvish@energyrecovery.com': 'Manoochehr Darvish',
    'mimam@energyrecovery.com': 'Muhammad Ali Imam',
    'jaramos@energyrecovery.com': 'James Ramos',
    'psamudrala@energyrecovery.com': 'Prakash Samudrala',
    'rramanan@energyrecovery.com': 'Ram Ramanan',
    'slee@energyrecovery.com': 'Steven Lee',
    'too@energyrecovery.com': 'Thurein Oo',
    'agajjar@energyrecovery.com': 'Aatam Gajjar',
    'kvostermans@energyrecovery.com': 'Kai Vostermans',
    'yrussom@energyrecovery.com': 'Yowhannes Russom',
    'asrivastava@energyrecovery.com': 'Ayush Srivastava',
    'pgaonkar@energyrecovery.com': 'Prajay Gaonkar',
    'atheodossiou@energyrecovery.com': 'Alexandros Theodossiou',
};

async function main() {
    console.log("Loading users from Table Storage...");
    const users = [];
    const entities = usersClient.listEntities({ queryOptions: { filter: "PartitionKey eq 'users'" } });
    for await (const entity of entities) {
        users.push({
            userId: entity.rowKey,
            email: entity.email || '',
            displayName: entity.displayName || ''
        });
    }
    console.log(`Found ${users.length} users.\n`);

    let populated = 0;
    let skipped = 0;
    let noMatch = 0;

    for (const user of users) {
        if (user.displayName) {
            console.log(`  - ${user.email || user.userId}: already has "${user.displayName}"`);
            skipped++;
            continue;
        }

        const name = NAME_MAP[(user.email || '').toLowerCase()];
        if (!name) {
            console.log(`  ? ${user.email || user.userId}: no match in name list`);
            noMatch++;
            continue;
        }

        await usersClient.upsertEntity({
            partitionKey: "users",
            rowKey: user.userId,
            displayName: name
        }, "Merge");
        console.log(`  + ${user.email} -> ${name}`);
        populated++;
    }

    console.log(`\nDone. Populated: ${populated}, Skipped: ${skipped}, No match: ${noMatch}`);
}

main().catch(err => {
    console.error("Fatal error:", err.message);
    process.exit(1);
});
