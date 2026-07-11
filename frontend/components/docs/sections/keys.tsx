import { CodeTabs } from "@/components/docs/code-tabs";
import { Code } from "@/components/doc-code";
import { DocBody, P, H3, Callout, DataTable } from "@/components/docs/prose";

const GENERATE = {
  python: `key = generate_key(
    algorithm="kyber_768",
    key_type="encryption",     # or "signature", "rotation", "delegation", "emergency"
    organization="hospital-a",
    owner="dr_smith",
    metadata={"purpose": "cardiology"},
)
key.key_id`,
  typescript: `const key = await generateKey({
  algorithm: "kyber_768",
  keyType: "encryption",       // or "signature", "rotation", "delegation", "emergency"
  organization: "hospital-a",
  owner: "dr_smith",
});
key.keyId;

const all = await listKeys();  // every managed key`,
};

const LIFECYCLE = {
  python: `info = get_key(key.key_id)                  # public key info by id

rotate_key(key.key_id, grace_period="24h") # mint a successor; old key retained for existing data
revoke_key(key.key_id, reason="compromised")  # cut off all future access`,
  typescript: `const info = await getKey(key.keyId);            // public key info by id

await rotateKey(key.keyId, { gracePeriod: "24h" }); // mint a successor; old key retained
await revokeKey(key.keyId, { reason: "compromised" }); // cut off all future access`,
};

export default function Keys() {
  return (
    <DocBody>
      <P>
        Keys follow a lifecycle — Created → Active → Rotated → Revoked/Expired/Archived — over an org → department →
        user hierarchy. The core stores them; for production, back it with an HSM or cloud KMS.
      </P>

      <H3>Generate &amp; list</H3>
      <CodeTabs python={GENERATE.python} typescript={GENERATE.typescript} />

      <H3>Get, rotate, revoke</H3>
      <P>
        Rotation mints a successor without re-encrypting existing data (the old key is retained for it); revocation
        updates policy enforcement immediately.
      </P>
      <CodeTabs python={LIFECYCLE.python} typescript={LIFECYCLE.typescript} />

      <DataTable
        head={["Operation", "Python", "TypeScript"]}
        rows={[
          ["Generate", <Code key="a">generate_key(...)</Code>, <Code key="b">generateKey(...)</Code>],
          ["List all", <Code key="c">—</Code>, <Code key="d">listKeys()</Code>],
          ["Get by id", <Code key="e">get_key(id)</Code>, <Code key="f">getKey(id)</Code>],
          ["Rotate", <Code key="g">rotate_key(id, grace_period=…)</Code>, <Code key="h">rotateKey(id, opts)</Code>],
          ["Revoke", <Code key="i">revoke_key(id, reason=…)</Code>, <Code key="j">revokeKey(id, opts)</Code>],
        ]}
      />

      <Callout tone="amber">
        A missing or revoked key raises <Code>KeyNotFoundError</Code> (both SDKs). The dev configuration keeps keys
        in memory or the local store; point <Code>KEY_STORAGE</Code> at an HSM / AWS-KMS / Azure-KMS backend for
        production.
      </Callout>
    </DocBody>
  );
}
