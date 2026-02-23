# Design: Migrate from userId to email as primary identifier

**Date**: 2026-02-22
**Status**: Approved

## Problem

Azure SWA Free tier pre-configured AAD auth generates a `userId` that is not stable. It changed when `staticwebapp.config.json` was temporarily broken, giving users new userIds and losing access to their old data. Since there are multiple active users, we need a permanent fix.

## Decision

Switch to `clientPrincipal.userDetails` (email) as the primary identifier everywhere. Email is stable across SWA config changes and human-readable.

## Approach: Two-Phase Deploy

### Deploy 1 — Migration endpoint (additive, no breaking changes)
Add an admin-only `api/MigrateToEmail/` endpoint that copies all existing userId-keyed data to email-keyed records. Old records preserved as safety net.

### Deploy 2 — Code changes (switch all code to use email)
Update all API functions + frontend to use email instead of userId.

## Core Identity Module (`api/shared/tableClient.js`)

New export `getUserEmail(clientPrincipal)`:
- Returns `clientPrincipal.userDetails.toLowerCase()`
- Single source of truth for user identity

Updated functions:
- `isAdmin(email)` — looks up by email instead of userId
- `ensureUser(req)` — writes `rowKey: email` instead of `rowKey: userId`

## API Function Changes

Three categories:

| Category | Files | Changes |
|---|---|---|
| Auth-only | CheckAdmin, GetProjects, GetProjectAnalytics, GetProjectBudgets, PopulateDisplayNames | Null-check + isAdmin call use `userEmail` |
| Current-user table keys | GetAllTimeAllocations, SaveTimeAllocation, GetUserSettings, SaveUserSettings | Plus PartitionKey/filter/rowKey use `userEmail` |
| Admin target functions | UpdateUser, SaveTimeAllocationForUser, GetAllUsersTimesheets, GetUsers | Plus request body params + target lookups use email |

### Deleted endpoints
- `api/GetAdmins/` — unused by frontend, admins table deprecated
- `api/UpdateAdmins/` — unused by frontend, admins table deprecated

### Power Automate payload
The `userId` field **name** stays the same (per CLAUDE.md contract). Only the **value** changes from hex string to email. The `userEmail` field remains as-is. Both are typed as strings — no breakage.

## Frontend Changes

### `admin.js`
- Dropdown values: `opt.value = user.email` (was `user.userId`)
- Toggle admin: send `{ action: 'toggleAdmin', userEmail: user.email }` (was `userId`)
- GetAllUsersTimesheets query: `?userEmail=...` (was `?userId=...`)
- SaveTimeAllocationForUser body: `targetUserEmail` (was `targetUserId`)
- Data matching: match by email

### `index.js`
- Line ~2243: fallback display `userInfo.userDetails` (was `userInfo.userId`)

### `server.js`
- Mock data uses email in userId fields
- Query param filtering updated

## GetUsers API Response
- Field renamed from `userId` to `email` as the primary identifier
- The `email` field already existed; `userId` is dropped from the response

## UpdateUser Self-Check
- Self-toggle prevention compares emails: `userEmail === callerEmail`

## Migration Endpoint (`api/MigrateToEmail/index.js`)

Admin-only, GET method, idempotent:

1. **Users table**: Read all `PartitionKey eq 'users'` records. For each with an email field, create new record with `rowKey = email.toLowerCase()`. Uses `upsertEntity("Merge")`.

2. **Engtime table**: Read all records. For each, look up email from userId-to-email map. Create copy with `partitionKey = email`, same rowKey. Uses `upsertEntity("Merge")`.

3. **Response**: `{ success, users: { migrated, skipped, failed }, engtime: { migrated, skipped, failed } }`

Old records not deleted — safety net for rollback.

## Files Changed Summary

| File | Change type |
|---|---|
| `api/MigrateToEmail/index.js` | NEW |
| `api/MigrateToEmail/function.json` | NEW |
| `api/shared/tableClient.js` | EDIT |
| `api/CheckAdmin/index.js` | EDIT |
| `api/GetProjects/index.js` | EDIT |
| `api/GetProjectAnalytics/index.js` | EDIT |
| `api/GetProjectBudgets/index.js` | EDIT |
| `api/PopulateDisplayNames/index.js` | EDIT |
| `api/GetAllTimeAllocations/index.js` | EDIT |
| `api/SaveTimeAllocation/index.js` | EDIT |
| `api/GetUserSettings/index.js` | EDIT |
| `api/SaveUserSettings/index.js` | EDIT |
| `api/UpdateUser/index.js` | EDIT |
| `api/SaveTimeAllocationForUser/index.js` | EDIT |
| `api/GetAllUsersTimesheets/index.js` | EDIT |
| `api/GetUsers/index.js` | EDIT |
| `api/UpdateProject/index.js` | EDIT |
| `api/SaveProjectBudget/index.js` | EDIT |
| `api/GetAdmins/` | DELETE |
| `api/UpdateAdmins/` | DELETE |
| `admin.js` | EDIT |
| `index.js` | EDIT |
| `server.js` | EDIT |

## Verification
1. Deploy migration endpoint, call it, confirm success counts
2. Login, verify old timesheets appear
3. Save new timesheet, confirm email-keyed PartitionKey in Table Storage
4. Admin console: verify user list, toggle admin, view/edit other users' timesheets
5. Check Power Automate flow triggers successfully after a save

## Rollback
Old userId-keyed records preserved (not deleted). Revert code to restore original behavior. Migration endpoint uses `upsertEntity("Merge")` so re-running is safe.
