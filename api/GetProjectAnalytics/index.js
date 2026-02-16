const { createTableClient, getUserInfo, isAdmin } = require("../shared/tableClient");

const engtimeClient = createTableClient("engtime");
const budgetsClient = createTableClient("projectbudgets");
const projectsClient = createTableClient("projects");

module.exports = async function (context, req) {
    context.log('GetProjectAnalytics function processing request.');

    const clientPrincipal = getUserInfo(req);
    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    const adminStatus = await isAdmin(clientPrincipal.userId);
    if (!adminStatus) {
        context.res = { status: 403, body: "Admin access required." };
        return;
    }

    try {
        // Step 1: Load all budgets
        const budgetMap = {};
        const budgetEntities = budgetsClient.listEntities({
            queryOptions: { filter: "PartitionKey eq 'budgets'" }
        });
        for await (const entity of budgetEntities) {
            budgetMap[entity.rowKey] = {
                budgetHours: entity.budgetHours || 0,
                budgetPeriodStart: entity.budgetPeriodStart || '',
                budgetPeriodEnd: entity.budgetPeriodEnd || ''
            };
        }

        // Step 2: Load project names
        const projectNameMap = {};
        const projectEntities = projectsClient.listEntities({
            queryOptions: { filter: "PartitionKey eq 'projects'" }
        });
        for await (const entity of projectEntities) {
            projectNameMap[entity.rowKey] = entity.name || entity.rowKey;
        }

        // Step 3: Scan all timesheet entries and aggregate
        const projectAggregation = {};
        const engtimeEntities = engtimeClient.listEntities();

        for await (const entity of engtimeEntities) {
            const projectId = entity.projectId;
            if (!projectId) continue;

            // Optional: filter by budget period dates
            const budget = budgetMap[projectId];
            if (budget && budget.budgetPeriodStart && budget.budgetPeriodEnd) {
                const weekStart = entity.weekStartDate;
                if (weekStart) {
                    const parts = weekStart.split('/');
                    if (parts.length === 3) {
                        const entryDate = new Date(parts[2], parts[0] - 1, parts[1]);
                        const periodStart = new Date(budget.budgetPeriodStart);
                        const periodEnd = new Date(budget.budgetPeriodEnd);
                        if (entryDate < periodStart || entryDate > periodEnd) {
                            continue; // Skip entries outside budget period
                        }
                    }
                }
            }

            const hours = Number(entity.hours) || 0;
            const userEmail = entity.userEmail || entity.partitionKey;

            if (!projectAggregation[projectId]) {
                projectAggregation[projectId] = {
                    projectId: projectId,
                    projectName: projectNameMap[projectId] || entity.projectName || projectId,
                    actualHours: 0,
                    userBreakdown: {}
                };
            }

            projectAggregation[projectId].actualHours += hours;

            if (!projectAggregation[projectId].userBreakdown[userEmail]) {
                projectAggregation[projectId].userBreakdown[userEmail] = 0;
            }
            projectAggregation[projectId].userBreakdown[userEmail] += hours;
        }

        // Step 4: Combine with budgets and format response
        const analytics = Object.values(projectAggregation).map(proj => {
            const budget = budgetMap[proj.projectId];
            const budgetHours = budget ? budget.budgetHours : 0;
            const isOverBudget = budgetHours > 0 && proj.actualHours > budgetHours;

            return {
                projectId: proj.projectId,
                projectName: proj.projectName,
                budgetHours: budgetHours,
                actualHours: Math.round(proj.actualHours * 10) / 10,
                isOverBudget: isOverBudget,
                overBy: isOverBudget ? Math.round((proj.actualHours - budgetHours) * 10) / 10 : 0,
                userBreakdown: Object.entries(proj.userBreakdown).map(([email, hours]) => ({
                    userEmail: email,
                    totalHours: Math.round(hours * 10) / 10
                })).sort((a, b) => b.totalHours - a.totalHours)
            };
        });

        // Sort: over-budget first, then by actual hours descending
        analytics.sort((a, b) => {
            if (a.isOverBudget && !b.isOverBudget) return -1;
            if (!a.isOverBudget && b.isOverBudget) return 1;
            return b.actualHours - a.actualHours;
        });

        context.res = { status: 200, body: analytics };
    } catch (err) {
        context.log.error("Error generating analytics:", err);
        context.res = { status: 500, body: `Error generating analytics: ${err.message}` };
    }
};
