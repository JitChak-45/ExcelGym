# Security Specification — Excel Career Academy

## 1. Data Invariants
1. **Strict PII & Progress Isolation**: `/users/{userId}` and `/users/{userId}/progress/{progressId}` may only be read or modified by `request.auth.uid == userId` (verified user) or a verified admin.
2. **Master Gate**: Subcollection `/users/{userId}/progress/{progressId}` requires that the parent `/users/{userId}` document exists.
3. **No Self-Assigned Admin**: Users cannot create or update `/admins/{adminUid}` or inject `role`/`isAdmin` shadow keys into `/users/{userId}`.
4. **Immutable Audit Logs**: `/exerciseAttempts/{attemptId}` and `/certificates/{certificateId}` are append-only for learners (no learner updates or deletes; `userId` must match `request.auth.uid`; timestamps must equal `request.time`).
5. **Admin-Only Curriculum Writes**: Only verified admins (bootstrapped admin email with `email_verified == true` or document in `/admins/{uid}`) can create, update, or delete `/customContent/{contentId}`. Learners may only read documents where `published == true`.
6. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time` on creation/update; `createdAt` and `uid`/`userId` are immutable after creation.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on User Profile**: Creating `/users/{uid}` with extra field `isAdmin: true`. -> `PERMISSION_DENIED` (`hasOnly` check).
2. **Cross-User PII Read**: Authenticated User B attempting `get` on `/users/userA`. -> `PERMISSION_DENIED`.
3. **Cross-User Profile List Scrape**: Authenticated User B attempting `list` on `/users`. -> `PERMISSION_DENIED` (admin-only list).
4. **Spoofed User ID on Exercise Attempt**: User A creating `/exerciseAttempts/att1` with `userId: "userB"`. -> `PERMISSION_DENIED`.
5. **Unverified Email Write**: Authenticated user with `email_verified: false` creating `/users/{uid}`. -> `PERMISSION_DENIED`.
6. **Admin Email Spoof (Unverified)**: User with email `jitchak95@gmail.com` and `email_verified: false` attempting admin write to `/customContent/c1`. -> `PERMISSION_DENIED`.
7. **ID Poisoning**: Attempting to write `/users/../../../evil` or a 200-char ID. -> `PERMISSION_DENIED` (`isValidId`).
8. **Backdated Timestamp**: Creating `/exerciseAttempts/att2` with client-supplied `createdAt` instead of `request.time`. -> `PERMISSION_DENIED`.
9. **Attempt Tampering**: Learner updating `/exerciseAttempts/att1` to change `score` from 20 to 100. -> `PERMISSION_DENIED` (immutable attempts).
10. **Non-Admin Curriculum Publish**: Regular learner creating or updating `/customContent/ex1`. -> `PERMISSION_DENIED`.
11. **Unpublished Content Leak**: Regular learner reading `/customContent/draft1` where `published == false`. -> `PERMISSION_DENIED`.
12. **Value Poisoning on Update**: Learner updating `/users/{uid}` with `fullName` of 500 characters or wrong type (`xp: "million"`). -> `PERMISSION_DENIED` (`isValidUserProfile` runs on update).
