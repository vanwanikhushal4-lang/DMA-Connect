# DMA Connect State District and Taluka workflow

State → District → Taluka now each have one president, one maker and one checker. Ward/local and cell presidents remain in the hierarchy without their own operational teams, as confirmed by the user. The Super Admin configures units and operational seats; ordinary president/member account work always passes through a maker and a separate checker.

| Team | President appointments handled |
| --- | --- |
| State | State president and child District presidents |
| District | Child Taluka and cell presidents |
| Taluka | Ward and local presidents within its branch |

Presidents are view-only for organisational work. Makers submit member registrations, member/president invitations and account appointment/status changes. Checkers approve or reject only submissions belonging to their own team. They cannot submit account work or review their own submissions. A revoked maker, inactive committee or occupied appointment invalidates a pending approval. Rejection requires a reason. Approval and its resulting data writes occur in one Firestore transaction, so duplicate/concurrent approvals apply once.

Self-signed members retain personal profile editing and committee requests. Taluka checkers handle area/ward/local membership requests; District checkers handle cell requests. A checker cannot approve their own membership request. Area and cell decisions remain independent, and a person is counted once across affiliations.

## Workspace

- Maker home: Submit member. Management → Accounts submits invitations and president account changes; Work shows submission status.
- Checker home: Review work. Management → Requests and Affiliations handles assigned memberships.
- President home: Overview. Statistics, Members, Work, Requests and appointed accounts show activity within the assigned scope.
- Super Admin: Overview and Setup. Create a District, Taluka, ward/local or cell; invite one maker and checker or assign an existing identity. Occupied/reserved seats reject duplicates. Remove the current operational seat before replacement.

Work history includes the submitting identity, team, timestamp, complete immutable payload, reviewer identity, decision time and note. Pending photos are served by a scoped backend endpoint. Work summaries and details use authenticated callable APIs; direct Firestore writes and private collection reads remain denied. Existing indexed real-time workspace snapshots remain necessary for multi-user approval updates, so the backend retains classic Firestore queries for this flow.

## Data and rollout

`committees` store `teamId` (membership-review team), `appointmentTeamId` (account-creation team), and separate president/maker/checker seat and pending-invitation fields. `workItems` store pending/approved/declined/withdrawn work with immutable payloads and scoped visibility. `area-*` IDs remain stable; their level becomes `taluka` while `branch: area` and home-area fields remain compatible. The new `dma-state` parent adds state ancestry to active affiliations and access records.

`functions/scripts/upgrade-hierarchy.js` is dry-run by default. Apply to the demo first, after an export. It preserves profiles, account UIDs and affiliations; upgrades ancestry; separates the central owner from the district president seat; and cancels legacy unchecked pending invitations so they can be resubmitted. Never rerun bootstrap against an existing hierarchy to perform this migration.

Production rollout remains separate from local development: back up, deploy the backend and rules with new indexes, wait for indexes to be READY, upgrade data, configure teams, verify each role, then publish the client. Real SMS remains deferred to Twilio. The development Auth emulator displays fresh simulated OTPs and sends no SMS.

## Verification commands

`npm run lint`, `npm run typecheck`, `npm test`, and backend domain tests are required. `npm run test:workflow` runs the new hierarchy/access/approval checks in isolated `demo-dma-workflow` on separate ports. `npm run test:integration` runs the member, rules, photos, birthday and legacy-data regressions in isolated `demo-dma-community`. Neither integration workflow clears the interactive `demo-dma-connect` preview.
