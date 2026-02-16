const { createTableClient, getUserInfo, isAdmin, ensureUser, isAllowedDomain } = require("../shared/tableClient");

module.exports = async function (context, req) {
    context.log('GetProjectAnalytics function processing request.');

    const engtimeClient = createTableClient("engtime");
    const projectsClient = createTableClient("projects");

    const clientPrincipal = getUserInfo(req);
    if (!clientPrincipal || !clientPrincipal.userId) {
        context.res = { status: 401, body: "User not authenticated." };
        return;
    }

    if (!isAllowedDomain(clientPrincipal)) {
        context.res = { status: 403, body: "Access restricted to energyrecovery.com accounts." };
        return;
    }

    await ensureUser(req);

    const adminStatus = await isAdmin(clientPrincipal.userId);
    if (!adminStatus) {
        context.res = { status: 403, body: "Admin access required." };
        return;
    }

    try {
        // Step 1: Load all projects (includes budget FTE per quarter)
        const projectMap = {};
        const projectEntities = projectsClient.listEntities({
            queryOptions: { filter: "PartitionKey eq 'projects'" }
        });
        for await (const entity of projectEntities) {
            projectMap[entity.rowKey] = {
                name: entity.name || entity.rowKey,
                budgetQ1: entity.budgetQ1 || 0,
                budgetQ2: entity.budgetQ2 || 0,
                budgetQ3: entity.budgetQ3 || 0,
                budgetQ4: entity.budgetQ4 || 0
            };
        }

        // Parse optional date range query parameters (ISO format: YYYY-MM-DD)
        const startDateParam = req.query.startDate;
        const endDateParam = req.query.endDate;
        let filterStartDate = null;
        let filterEndDate = null;
        const useCurrentYearFilter = !startDateParam && !endDateParam;

        if (startDateParam) {
            filterStartDate = new Date(startDateParam + 'T00:00:00');
            if (isNaN(filterStartDate.getTime())) {
                context.res = { status: 400, body: "Invalid startDate format. Use YYYY-MM-DD." };
                return;
            }
        }
        if (endDateParam) {
            filterEndDate = new Date(endDateParam + 'T23:59:59');
            if (isNaN(filterEndDate.getTime())) {
                context.res = { status: 400, body: "Invalid endDate format. Use YYYY-MM-DD." };
                return;
            }
        }

        // Step 2: Scan all timesheet entries and aggregate (filtered by date range)
        const currentYear = new Date().getFullYear();
        const projectAggregation = {};
        const engtimeEntities = engtimeClient.listEntities();

        for await (const entity of engtimeEntities) {
            const projectId = entity.projectId;
            if (!projectId) continue;

            const weekStart = entity.weekStartDate;
            if (!weekStart) continue;

            const parts = weekStart.split('/');
            if (parts.length !== 3) continue;

            const entryDate = new Date(parts[2], parts[0] - 1, parts[1]);

            // Apply date filter: backward-compat current-year or explicit range
            if (useCurrentYearFilter) {
                if (entryDate.getFullYear() !== currentYear) continue;
            } else {
                if (filterStartDate && entryDate < filterStartDate) continue;
                if (filterEndDate && entryDate > filterEndDate) continue;
            }

            const month = entryDate.getMonth(); // 0-11
            const quarter = Math.floor(month / 3) + 1; // 1-4

            const hours = Number(entity.hours) || 0;
            const userEmail = entity.userEmail || entity.partitionKey;

            if (!projectAggregation[projectId]) {
                const proj = projectMap[projectId] || {};
                projectAggregation[projectId] = {
                    projectId: projectId,
                    projectName: proj.name || entity.projectName || projectId,
                    actualHours: 0,
                    expectedHours: 0,
                    weeksTracked: new Set(),
                    quarterWeeks: { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() },
                    userBreakdown: {},
                    budgetQ1: proj.budgetQ1 || 0,
                    budgetQ2: proj.budgetQ2 || 0,
                    budgetQ3: proj.budgetQ3 || 0,
                    budgetQ4: proj.budgetQ4 || 0
                };
            }

            projectAggregation[projectId].actualHours += hours;
            projectAggregation[projectId].weeksTracked.add(weekStart);
            projectAggregation[projectId].quarterWeeks[quarter].add(weekStart);

            if (!projectAggregation[projectId].userBreakdown[userEmail]) {
                projectAggregation[projectId].userBreakdown[userEmail] = 0;
            }
            projectAggregation[projectId].userBreakdown[userEmail] += hours;
        }

        // Step 3: Compute expected hours per project
        // Expected hours per week = FTE * 40
        // Total expected = sum across quarters of (weeks_in_quarter * FTE_for_quarter * 40)
        for (const proj of Object.values(projectAggregation)) {
            let totalExpected = 0;
            for (let q = 1; q <= 4; q++) {
                const fte = proj[`budgetQ${q}`];
                const weeksInQuarter = proj.quarterWeeks[q].size;
                totalExpected += weeksInQuarter * fte * 40;
            }
            proj.expectedHours = totalExpected;
        }

        // Step 4: Format response
        const analytics = Object.values(projectAggregation).map(proj => {
            const budgetHours = proj.expectedHours;
            const isOverBudget = budgetHours > 0 && proj.actualHours > budgetHours;

            return {
                projectId: proj.projectId,
                projectName: proj.projectName,
                budgetHours: Math.round(budgetHours * 10) / 10,
                actualHours: Math.round(proj.actualHours * 10) / 10,
                budgetQ1: proj.budgetQ1,
                budgetQ2: proj.budgetQ2,
                budgetQ3: proj.budgetQ3,
                budgetQ4: proj.budgetQ4,
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
