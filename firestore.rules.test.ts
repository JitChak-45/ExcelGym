/**
 * Phase 0 Security Test Specification for Excel Career Academy Firestore Rules.
 * Verifies all 12 Dirty Dozen adversarial payloads return PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
}

export const dirtyDozenTests: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on User Profile',
    collectionPath: '/users/userA',
    operation: 'create',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { uid: 'userA', fullName: 'A', email: 'a@example.com', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-User PII Read',
    collectionPath: '/users/userA',
    operation: 'get',
    auth: { uid: 'userB', email: 'b@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-User Profile List Scrape',
    collectionPath: '/users',
    operation: 'list',
    auth: { uid: 'userB', email: 'b@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Spoofed User ID on Exercise Attempt',
    collectionPath: '/exerciseAttempts/att1',
    operation: 'create',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { userId: 'userB', careerPathId: 'inventory', score: 100 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unverified Email Write',
    collectionPath: '/users/userA',
    operation: 'create',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: false },
    payload: { uid: 'userA', fullName: 'A', email: 'a@example.com' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Admin Email Spoof without Verification',
    collectionPath: '/customContent/c1',
    operation: 'create',
    auth: { uid: 'spoof', email: 'jitchak95@gmail.com', email_verified: false },
    payload: { contentType: 'exercise', title: 'Hijack' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'ID Poisoning with Invalid Characters',
    collectionPath: '/users/invalid$id!@#',
    operation: 'create',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { uid: 'userA' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Backdated Timestamp on Exercise Attempt',
    collectionPath: '/exerciseAttempts/att2',
    operation: 'create',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { userId: 'userA', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Learner Score Tampering on Attempt',
    collectionPath: '/exerciseAttempts/att1',
    operation: 'update',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { score: 100, passed: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Non-Admin Curriculum Publish',
    collectionPath: '/customContent/ex1',
    operation: 'create',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { contentType: 'exercise', published: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unpublished Draft Content Read by Learner',
    collectionPath: '/customContent/draft1',
    operation: 'get',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Value Poisoning on User Update',
    collectionPath: '/users/userA',
    operation: 'update',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { xp: 'not-a-number', fullName: 'X'.repeat(500) },
    expected: 'PERMISSION_DENIED',
  },
];
