import Link from "next/link";
import { CodeTabs } from "@/components/docs/code-tabs";
import { Code } from "@/components/doc-code";
import { DocBody, P, H3, Callout } from "@/components/docs/prose";

const VERIFY_WALLET = {
  python: `# The core verifies the signed challenge; the resulting verified wallet
# attribute is then usable in any policy. Pass it through the identity you check with:
identity = {"role": "member", "wallet": "0xA11CE…CAFE"}  # verified upstream

decision = check(identity, policy={
    "conditions": [{"type": "wallet", "operator": "equals", "value": "0xA11CE…CAFE"}],
}, purpose="payment")`,
  typescript: `// 1) Verify a signed wallet/DID challenge with the SDK:
const res = await verifyWallet({
  scheme: "eip191",              // EVM personal_sign (default), or a DID auth proof
  publicKey: address,
  challenge,                     // the nonce the user signed
  signature,
});
res.valid;   // true if the signature is genuine
res.address; // the recovered wallet address

// 2) Feed the verified wallet as a subject attribute to the PDP:
if (res.valid) {
  const decision = await check(
    { role: "member", wallet: res.address },
    { conditions: [{ type: "wallet", operator: "equals", value: res.address }] },
    { purpose: "payment" },
  );
}`,
};

const BREAK_GLASS = {
  python: `policy = {
    "combination": "custom",
    "custom_logic": 'role == "manager" and (amount <= approval_limit or emergency)',
}
# emergency=true satisfies the rule when it would otherwise fail — and is always
# recorded as a distinctly-flagged evidence entry.
check({"role": "manager", "amount": 2_000_000, "approval_limit": 1_000_000, "emergency": True},
      policy=policy, purpose="approval")`,
  typescript: `const policy = {
  combination: "custom",
  custom_logic: 'role == "manager" and (amount <= approval_limit or emergency)',
};
// emergency=true satisfies the rule when it would otherwise fail — and is always
// recorded as a distinctly-flagged evidence entry.
await check(
  { role: "manager", amount: 2_000_000, approval_limit: 1_000_000, emergency: true },
  policy,
  { purpose: "approval" },
);`,
};

export default function Wallet() {
  return (
    <DocBody>
      <P>
        A signed wallet or DID challenge is verified by the core and yields a trusted <Code>wallet</Code>/
        <Code>did</Code> subject attribute usable in any policy. This is the identity half of PrivyQ&apos;s Web3
        story: <em>wallet authenticated → user requests a protected invoice → backend checks the policy → allowed →
        access reveals it</em> — with no smart-contract changes and no duplicated backend logic.
      </P>

      <H3>Verify a wallet, then decide</H3>
      <P>
        The TypeScript SDK exposes <Code>verifyWallet</Code> directly; in Python the verified attribute is resolved
        upstream (or via the gateway) and passed through the identity you check with.
      </P>
      <CodeTabs python={VERIFY_WALLET.python} typescript={VERIFY_WALLET.typescript} />

      <H3>Break-glass (emergency access)</H3>
      <P>
        An <Code>emergency</Code> environment attribute can satisfy an otherwise-failing policy when the policy
        explicitly allows it — always producing a distinctly-flagged evidence entry so the exceptional access is
        auditable.
      </P>
      <CodeTabs python={BREAK_GLASS.python} typescript={BREAK_GLASS.typescript} />

      <Callout tone="amber">
        Honesty: wallet/DID proofs are verified cryptographically, but PrivyQ <strong>decides</strong> — it does not
        authenticate for you. The trust in any other attribute is only as good as the provider that asserts it.
      </Callout>
      <Callout tone="mint">
        Walk the flow interactively (with a clearly-labelled simulated sign step) on the{" "}
        <Link href="/wallet">Wallet demo</Link>.
      </Callout>
    </DocBody>
  );
}
