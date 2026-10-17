# TODO - Live session attendance tracking (BackendAcademy)

## Step 1: Add persistence model
- Create `BackendAcademy/src/sessions/attendance.entity.ts` using TypeORM.
- Decide primary key and fields: `sessionKey`, `userId`, `joinedAt`, `leftAt`, `durationSeconds`.

## Step 2: Implement attendance service
- Create `BackendAcademy/src/sessions/attendance.service.ts`.
- Add methods: `join`, `leave`, `getSessionStats`.
- Join is idempotent per `(sessionKey,userId)` while active.

## Step 3: Implement controller + DTOs
- Create `BackendAcademy/src/sessions/dto/join-session-attendance.dto.ts`.
- Create `BackendAcademy/src/sessions/dto/leave-session-attendance.dto.ts`.
- Create `BackendAcademy/src/sessions/dto/get-session-attendance-stats.dto.ts` (if needed).
- Create `BackendAcademy/src/sessions/attendance.controller.ts` with endpoints:
  - `POST /api/v1/sessions/attendance/join`
  - `POST /api/v1/sessions/attendance/leave`
  - `GET /api/v1/sessions/attendance/:sessionKey/stats`

## Step 4: Add NestJS module wiring
- Create `BackendAcademy/src/sessions/sessions.module.ts` and register TypeORM entity + providers.

## Step 5: Wire into app
- Update `BackendAcademy/src/app.module.ts` to import `SessionsModule`.

## Step 6: Verify build
- Run `npm run build` (or `npm test`) inside `BackendAcademy`.

## Progress
- Step 1-5 implemented (sessions module + attendance tracking).

## Upstream Issue Fixes
- [x] [BA-053](https://github.com/BlockDash-Studios/RustAcademy/issues/966): reject self-follow requests at the service boundary with a clear error; existing guard and regression test satisfy the criteria.
- [x] [BA-083](https://github.com/BlockDash-Studios/RustAcademy/issues/996): order XP leaderboard rows by total XP descending, then user ID ascending; cover tied scores.
- [x] [BA-084](https://github.com/BlockDash-Studios/RustAcademy/issues/997): reject XP awards and total calculations that exceed the safe integer range.
- [x] [BA-085](https://github.com/BlockDash-Studios/RustAcademy/issues/998): reject missing or unsupported XP event source values before publishing.


