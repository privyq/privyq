import type {
  EvidenceLogEntry,
  KeyResponse,
  Policy,
} from "./types";

/**
 * Seed data so the UI is fully populated without a running backend.
 * Modelled on the medical-records scenario (BP §25) and the identities in
 * the original design prototype Replaced by live gateway data when the core is online.
 */

export interface DemoRecord {
  id: string;
  patientName: string;
  patientAge: number;
  summary: string;
  plaintext: string;
  classification: string;
  algorithm: string;
  keyId: string;
  policyHash: string;
  createdAt: string;
  owner: string;
  policy: Policy;
}

function policy(conditions: Policy["conditions"], description: string): Policy {
  return {
    version: "1.0",
    combination: "all",
    conditions,
    metadata: {
      created_at: "2026-07-01T09:00:00Z",
      created_by: "doctor_amara",
      description,
    },
  };
}

export const DEMO_RECORDS: DemoRecord[] = [
  {
    id: "patient_001",
    patientName: "John Doe",
    patientAge: 58,
    summary: "Cardiology — echocardiogram + medication review",
    plaintext: `Patient: John Doe (58)
Echo: mild LV hypertrophy. BP 132/84.
Plan: continue beta-blocker, review in 2 weeks.`,
    classification: "confidential",
    algorithm: "kyber_768",
    keyId: "key_card_a1",
    policyHash: "a8fdc205a9f19cc1c7507a60c4f01b13d11d7fd0",
    createdAt: "2026-07-02T08:15:00Z",
    owner: "Dr. Amara Okafor",
    policy: policy(
      [
        { type: "role", operator: "equals", value: "doctor" },
        { type: "department", operator: "equals", value: "cardiology" },
        { type: "purpose", operator: "equals", value: "treatment" },
        { type: "classification", operator: "equals", value: "confidential" },
        { type: "expiry", operator: "before", value: "2026-12-31T23:59:59Z" },
        { type: "organization", operator: "equals", value: "Hospital A" },
      ],
      "Cardiology treatment access",
    ),
  },
  {
    id: "patient_002",
    patientName: "Maria Alvarez",
    patientAge: 44,
    summary: "Oncology — chemotherapy cohort (research-eligible)",
    plaintext: `Patient: Maria Alvarez (44)
Dx: HER2+ breast carcinoma, stage II.
Enrolled: trial ONC-2291. Cycle 3 of 6.`,
    classification: "restricted",
    algorithm: "kyber_1024",
    keyId: "key_onc_b2",
    policyHash: "b1946ac92492d2347c6235b4d2611184a7bcd3f2",
    createdAt: "2026-07-03T10:40:00Z",
    owner: "Dr. Amara Okafor",
    policy: policy(
      [
        { type: "role", operator: "in", value: ["doctor", "researcher"] },
        { type: "department", operator: "equals", value: "oncology" },
        { type: "purpose", operator: "one_of", value: ["treatment", "research"] },
      ],
      "Oncology treatment or approved research",
    ),
  },
  {
    id: "patient_003",
    patientName: "Kwame Mensah",
    patientAge: 31,
    summary: "General medicine — routine admission notes",
    plaintext: `Patient: Kwame Mensah (31)
Admission: observation, suspected appendicitis.
Vitals stable. Awaiting ultrasound.`,
    classification: "internal",
    algorithm: "kyber_768",
    keyId: "key_gen_c3",
    policyHash: "c3499c2729730a7f807efb8676a92dcb6f8a3f8f",
    createdAt: "2026-07-05T14:05:00Z",
    owner: "Nurse Bello Musa",
    policy: policy(
      [
        { type: "role", operator: "in", value: ["doctor", "nurse"] },
        { type: "department", operator: "in", value: ["general", "cardiology"] },
        { type: "purpose", operator: "one_of", value: ["treatment", "administrative"] },
      ],
      "General ward staff access",
    ),
  },
];

export function getDemoRecord(id: string): DemoRecord | undefined {
  return DEMO_RECORDS.find((r) => r.id === id);
}

export const DEMO_KEYS: KeyResponse[] = [
  {
    key_id: "key_card_a1",
    public_key: "MIIBIjANBgkqh...kyber768...QIDAQAB",
    algorithm: "kyber_768",
    type: "encryption",
    status: "active",
    created_at: "2026-06-01T09:00:00Z",
    expires_at: "2026-12-01T09:00:00Z",
  },
  {
    key_id: "key_onc_b2",
    public_key: "MIIBIjANBgkqh...kyber1024...QIDAQAB",
    algorithm: "kyber_1024",
    type: "encryption",
    status: "active",
    created_at: "2026-06-10T09:00:00Z",
    expires_at: "2026-12-10T09:00:00Z",
  },
  {
    key_id: "key_sign_d4",
    public_key: "MIIBIjANBgkqh...dilithium3...QIDAQAB",
    algorithm: "kyber_768",
    type: "signing",
    status: "active",
    created_at: "2026-05-20T09:00:00Z",
    expires_at: "2026-11-20T09:00:00Z",
  },
  {
    key_id: "key_gen_c3",
    public_key: "MIIBIjANBgkqh...kyber768...QIDAQAB",
    algorithm: "kyber_768",
    type: "encryption",
    status: "rotated",
    created_at: "2026-03-01T09:00:00Z",
    expires_at: "2026-09-01T09:00:00Z",
  },
  {
    key_id: "key_old_e5",
    public_key: "MIIBIjANBgkqh...kyber512...QIDAQAB",
    algorithm: "kyber_512",
    type: "encryption",
    status: "revoked",
    created_at: "2026-01-15T09:00:00Z",
    expires_at: "2026-07-15T09:00:00Z",
  },
];

/** A short hash-chained evidence log (genesis → … each parent linking back). */
export const DEMO_EVIDENCE: EvidenceLogEntry[] = [
  {
    evidence_id: "ev_0001",
    timestamp: "2026-07-02T08:15:12Z",
    actor: { user_id: "doctor_amara", role: "doctor" },
    resource: { resource_id: "patient_001", resource_hash: "a8fdc205" },
    operation: "protect",
    result: "granted",
    signature: "3f1c…d90a",
  },
  {
    evidence_id: "ev_0002",
    timestamp: "2026-07-02T09:02:40Z",
    actor: { user_id: "doctor_amara", role: "doctor" },
    resource: { resource_id: "patient_001", resource_hash: "a8fdc205" },
    operation: "access",
    result: "granted",
    signature: "7b22…41ce",
  },
  {
    evidence_id: "ev_0003",
    timestamp: "2026-07-02T11:31:05Z",
    actor: { user_id: "nurse_bello", role: "nurse" },
    resource: { resource_id: "patient_001", resource_hash: "a8fdc205" },
    operation: "access",
    result: "denied",
    signature: "9c04…88fa",
  },
  {
    evidence_id: "ev_0004",
    timestamp: "2026-07-03T10:40:22Z",
    actor: { user_id: "doctor_amara", role: "doctor" },
    resource: { resource_id: "patient_002", resource_hash: "b1946ac9" },
    operation: "protect",
    result: "granted",
    signature: "1a77…52bd",
  },
  {
    evidence_id: "ev_0005",
    timestamp: "2026-07-04T13:12:58Z",
    actor: { user_id: "researcher_chen", role: "researcher" },
    resource: { resource_id: "patient_002", resource_hash: "b1946ac9" },
    operation: "access",
    result: "granted",
    signature: "e5d1…0b6f",
  },
  {
    evidence_id: "ev_0006",
    timestamp: "2026-07-05T14:05:33Z",
    actor: { user_id: "nurse_bello", role: "nurse" },
    resource: { resource_id: "patient_003", resource_hash: "c3499c27" },
    operation: "protect",
    result: "granted",
    signature: "44af…7c19",
  },
  {
    evidence_id: "ev_0007",
    timestamp: "2026-07-06T16:48:09Z",
    actor: { user_id: "researcher_chen", role: "researcher" },
    resource: { resource_id: "patient_003", resource_hash: "c3499c27" },
    operation: "access",
    result: "denied",
    signature: "b0e2…9d34",
  },
];
