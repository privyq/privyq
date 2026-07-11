import { CodeTabs } from "@/components/docs/code-tabs";
import { Code } from "@/components/doc-code";
import { DocBody, P, H3, Callout, DataTable } from "@/components/docs/prose";

const SEAL = {
  python: `sealed = seal(discharge_summary)          # post-quantum signature (ML-DSA)
# or pin a specific key / algorithm:
sealed = seal(discharge_summary, key_id="sig_123", algorithm="dilithium_3")

sealed.data_hash    # SHA-256 of the signed data
sealed.signature    # the Dilithium signature
sealed.algorithm    # "dilithium_3"
sealed.key_id       # signing key id
sealed.sealed_at    # timestamp`,
  typescript: `const sealed = await seal(dischargeSummary);        // post-quantum signature (ML-DSA)
// or pin a specific key / algorithm:
const pinned = await seal(dischargeSummary, { keyId: "sig_123", algorithm: "dilithium_3" });

sealed.dataHash;    // SHA-256 of the signed data
sealed.signature;   // the Dilithium signature
sealed.algorithm;   // "dilithium_3"
sealed.keyId;       // signing key id
sealed.sealedAt;    // timestamp`,
};

const VERIFY = {
  python: `# 1) Verify a Sealed signature over the original data:
res = verify(sealed, data=discharge_summary)

# 2) Or verify an audit receipt / evidence entry (dispatched by type):
res = verify(receipt)

res.ok                 # overall result
res.signature_valid    # the signature checks out
res.chain_valid        # hash-chain linkage is intact (for evidence)
res.policy_compliant   # the recorded decision matched the policy
res.detail             # human detail on failure`,
  typescript: `// 1) Verify a Sealed signature over the original data:
let res = await verify(sealed, { data: dischargeSummary });

// 2) Or verify an audit evidence entry (dispatched by type):
res = await verify(evidenceEntry);

res.ok;               // overall result
res.signatureValid;   // the signature checks out
res.chainValid;       // hash-chain linkage is intact (for evidence)
res.policyCompliant;  // the recorded decision matched the policy
res.detail;           // human detail on failure`,
};

export default function SealVerify() {
  return (
    <DocBody>
      <H3>seal</H3>
      <P>
        <Code>seal</Code> produces a post-quantum digital signature (ML-DSA / Dilithium) over arbitrary data,
        returning a <Code>Sealed</Code>. It replaces <Code>sign</Code> — the developer signs <em>intent</em>, not a
        raw key operation.
      </P>
      <CodeTabs python={SEAL.python} typescript={SEAL.typescript} />
      <DataTable
        head={["Sealed", "Python", "TypeScript"]}
        rows={[
          ["Data hash", <Code key="a">.data_hash</Code>, <Code key="b">.dataHash</Code>],
          ["Signature", <Code key="c">.signature</Code>, <Code key="d">.signature</Code>],
          ["Algorithm", <Code key="e">.algorithm</Code>, <Code key="f">.algorithm</Code>],
          ["Key id", <Code key="g">.key_id</Code>, <Code key="h">.keyId</Code>],
          ["Sealed at", <Code key="i">.sealed_at</Code>, <Code key="j">.sealedAt</Code>],
        ]}
      />

      <H3>verify</H3>
      <P>
        <Code>verify</Code> is dispatched by type: pass a <Code>Sealed</Code> (with the original data) to check a
        signature, or pass an audit receipt / evidence entry to check the chain. Both return a{" "}
        <Code>VerificationResult</Code>.
      </P>
      <CodeTabs python={VERIFY.python} typescript={VERIFY.typescript} />

      <Callout tone="blue">
        <Code>chain_valid</Code> / <Code>chainValid</Code> only applies to audit evidence — a standalone signature
        has no chain. For a wallet/DID signature specifically, see the{" "}
        <a href="/docs/wallet">wallet identity</a> page and TypeScript&apos;s <Code>verifyWallet</Code>.
      </Callout>
    </DocBody>
  );
}
