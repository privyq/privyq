import type * as React from "react";
import Introduction from "./introduction";
import Installation from "./installation";
import Configuration from "./configuration";
import ProtectAccess from "./protect-access";
import CheckExplain from "./check-explain";
import SealVerify from "./seal-verify";
import Evidence from "./evidence";
import Keys from "./keys";
import Policies from "./policies";
import Compliance from "./compliance";
import Wallet from "./wallet";
import RestApi from "./rest-api";

/** slug → content component. Keys must match `DOC_SECTIONS` in lib/docs.ts. */
export const SECTION_CONTENT: Record<string, React.ComponentType> = {
  introduction: Introduction,
  installation: Installation,
  configuration: Configuration,
  "protect-access": ProtectAccess,
  "check-explain": CheckExplain,
  "seal-verify": SealVerify,
  evidence: Evidence,
  keys: Keys,
  policies: Policies,
  compliance: Compliance,
  wallet: Wallet,
  "rest-api": RestApi,
};
