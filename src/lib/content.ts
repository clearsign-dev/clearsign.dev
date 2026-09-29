// Public copy. Support and verification claims are maintained in the main
// repository; historical design briefs are not current release evidence.

export const REPO_URL = "https://github.com/clearsign-dev/clearsign";
export const RELEASES_URL = `${REPO_URL}/releases`;
export const ISSUES_URL = `${REPO_URL}/issues/new/choose`;
export const SECURITY_URL = `${REPO_URL}/security/advisories/new`;

export const WARNING = {
  label: "Before you download",
  headline: "Developer preview. Not for real keys or funds.",
  body: "The reviewer needs no keys and signs nothing. Its display depends on the computer running it. Decoding does not verify contract behaviour; compare the hash on your signing device and follow your existing approval procedure.",
} as const;

export const PRELOADER = {
  messages: ["Please stand by", "Reading the bytes", "Building the scene"],
  gate: {
    title: "Enter with sound",
    subtitle: "(A low drone. Turn it off any time.)",
    button: "Start",
  },
  loadingLabel: "Loading",
} as const;

export const MENU = {
  contact: "Tell us what it missed",
  note: "The most useful thing anyone can send is a transaction this read badly.",
} as const;

export const HEADER = {
  menu: "Menu",
  close: "Close",
  cta: "Get ClearSign",
  soundKicker: "Ambient",
  soundOn: "Sound on",
  soundOff: "Sound off",
  soundEnable: "Enable sound",
  soundMute: "Mute sound",
} as const;

// 0 — Opening. Anatomy: the reference hero.
export const HERO = {
  metaPrimary: "Reads a transaction from the raw bytes",
  metaSecondary: "Reviews offline",
  metaTertiary: "Early development",
  clockLabel: "UTC",
  heading: ["ClearSign", "Review before", "you sign"],
} as const;

// 1 — The problem. Anatomy: the reference About.
export const PROBLEM = {
  heading: ["Nobody reads", "the bytes"],
  paragraphs: [
    "A multisig interface can show a plausible summary while asking you to approve different bytes. A hash comparison helps bind the review to the signature, but does not explain the transaction.",
    "The Bybit theft on 21 February 2025 showed the consequences of a compromised signing interface: about $1.5 billion was stolen.",
  ],
} as const;

// 2 — What it reads. Anatomy: the reference Services (hover-to-explore
// hotspots on desktop, cards on mobile).
export const READS = {
  heading: ["What it reads"],
  sup: "2",
  hotspotHint: "Hover to explore",
  groups: [
    {
      title: "Transactions and Safe calls",
      summary: "EVM transactions and Safe multisig",
      items: [
        "EIP-1559 and legacy transactions, strict canonical RLP",
        "ERC-20-shaped transfer, transferFrom and approve calls",
        "Unlimited approvals named as unlimited",
        "Safe execTransaction, with the inner call and its operation",
        "The Safe transaction hash, recomputed locally",
        "Safe administration changes flagged for review",
      ],
    },
    {
      title: "Batches, QR and agents",
      summary: "What arrives by batch, camera or assistant",
      items: [
        "MultiSend batches, with explicit display and parsing limits",
        "Only Safe's 11 published MultiSend deployments",
        "On the 2,089 address-chain pairs they are published for",
        "Air-gapped QR requests over Uniform Resources and EIP-4527",
        "Wallet claims checked against the signed bytes",
        "AI agent plans, traced and approved finding by finding",
      ],
    },
  ],
} as const;

export type Severity = "INFO" | "WARNING" | "CRITICAL" | "BLIND";

// 3 — Proof. Anatomy: the reference Collaboration.
export const PROOF = {
  heading: ["The Bybit", "test case"],
  cta: "Repeat it yourself",
  ctaHref: REPO_URL,
  // The large statement across the bottom; `highlight` is lit.
  statement: [
    "The signers were shown transfer. The bytes said DELEGATECALL. ClearSign answers ",
    { text: "DO NOT SIGN", highlight: true },
    ".",
  ],
  record: {
    title: "Safe transaction, 21 February 2025",
    rows: [
      ["Safe", "0x1Db92e2EeBC8E0c075a02BeA49a2935BcD2dFCF4"],
      ["Nonce", "71"],
      ["Safe tx hash", "0xb3476d061aeb8fc1d605a873c483a2402d88a68a9cdd1a8b47655dd55ba004f8"],
      ["Selector shown", "0xa9059cbb  transfer(address,uint256)"],
      ["Operation", "DELEGATECALL (operation byte 1, not 0)"],
      ["Code that ran as the Safe", "0x96221423681A6d52E184D440a8eFCEbB105C7242"],
    ],
    output: [
      { severity: "CRITICAL" as Severity, code: "SAFE_DELEGATECALL" },
    ],
    verdict: "DO NOT SIGN",
    footnote:
      "A retrospective test using Safe's production record. ClearSign did not prevent this incident. The fixture and its source command are in the repository.",
  },
  severities: [
    { severity: "INFO" as Severity, text: "Context and limitations" },
    { severity: "WARNING" as Severity, text: "Worth a second look" },
    { severity: "CRITICAL" as Severity, text: "Delegatecall, owner, module or guard changes, unlimited approvals" },
    { severity: "BLIND" as Severity, text: "Anything it does not fully understand" },
  ],
  exitCodes: "Exit 0: no BLIND or CRITICAL findings, not a safety guarantee. Exit 2: BLIND content. Exit 3: CRITICAL findings.",
} as const;

// 4 — Evidence. Anatomy: the reference Blog slider.
export const EVIDENCE = {
  heading: ["The evidence"],
  description:
    "Tests and recorded experiments are documented in the repository. Results apply to the versions and environments tested.",
  slides: [
    {
      kicker: "Testing",
      figure: "CI",
      title: "Workspace regression tests",
      body: "Run cargo test --workspace --release --locked for current results. The verification record documents the coverage and known gaps.",
    },
    {
      kicker: "Fuzzing",
      figure: "~306M",
      title: "Recorded fuzz executions",
      body: "Historical runs across seven targets. The record includes assertions later found inadequate; execution counts are not a security guarantee.",
    },
    {
      kicker: "Differential",
      figure: "6 × 3,000",
      title: "Checked against alloy",
      body: "An independent implementation. Whenever ClearSign accepts mutated calldata, alloy must accept it and re-encode it identically.",
    },
    {
      kicker: "Planted bugs",
      figure: "Faults",
      title: "Tests checked with planted bugs",
      body: "Deliberately reintroducing bugs exposed tests that passed incorrectly. The verification record describes corrections and remaining gaps.",
    },
    {
      kicker: "Reproducible",
      figure: "1",
      title: "Canonical build environment",
      body: "Recorded aarch64 Linux builds matched in the canonical environment, including on a second machine. This does not cover all desktop installers or compiler hosts.",
    },
    {
      kicker: "Supply chain",
      figure: "1,057",
      title: "GrapheneOS manifest entries",
      body: "The recorded source-import check pinned 1,057 projects and verified the manifest tag against a pinned key. This is a supply-chain check, not a claim that ClearSign has GrapheneOS's security properties.",
    },
    {
      kicker: "Review",
      figure: "Open",
      title: "Independent re-review still needed",
      body: "The verification record separates the reported September human review from later AI-assisted checks. Changed signing-critical code still needs independent human assessment.",
    },
    {
      kicker: "Not true yet",
      figure: "0",
      title: "Users",
      body: "No established user base. Signing hardware remains experimental; binaries are unsigned. Selected EVM formats only, with no general EIP-712 support.",
      gap: true,
    },
  ],
} as const;

// 5 — How it ships. Anatomy: the reference Partners (a column of cards).
export const SHIPS = {
  heading: ["How it", "ships"],
  sup: "5",
  paragraph: "The same Rust core, in three shapes, and a prototype of what sits above them.",
  cards: [
    {
      id: "01",
      name: "Desktop application",
      detail: "macOS, Windows and Linux. Paste a transaction, drop a file, or fetch one by its Safe hash. Twelve networks.",
      status: "Unsigned",
      icon: "desktop",
    },
    {
      id: "02",
      name: "Command line",
      detail: "Reads Safe transaction JSON and ignores the service's dataDecoded description. Exit codes distinguish decoding findings.",
      status: "Read-only",
      icon: "terminal",
    },
    {
      id: "03",
      name: "Signer image",
      detail: "An experimental Linux image with a single user program and a kernel built without a network stack.",
      status: "Emulation only",
      icon: "chip",
    },
    {
      id: "04",
      name: "Compartments",
      detail: "seL4 runs an untrusted Linux beside the signer. Linux tries to write the review region, and seL4 blocks it.",
      status: "Emulated prototype",
      icon: "layers",
    },
  ],
} as const;

// 6 — Get it. Anatomy: the reference Process (three step cards).
export const GET_IT = {
  heading: ["Run it before", "you approve"],
  steps: [
    {
      title: "Download",
      body: "The desktop app for macOS, Windows and Linux, from the releases page. It is not yet code-signed or notarised.",
      action: { label: "Releases", href: RELEASES_URL },
    },
    {
      title: "Review",
      body: "Review a historical transaction locally. No recovery phrase or private key is needed; the host computer remains part of the trust boundary.",
      command: "clearsign safe-json tx.json --chain-id 1",
    },
    {
      title: "Compare",
      body: "Read the Safe hash it recomputes against your hardware wallet's screen and the other signers' copies.",
    },
  ],
  warning: WARNING,
} as const;

// 7 — Contact. Anatomy: the reference Contact.
export const CONTACT = {
  heading: ["Tell us what", "it missed"],
  lead: "Bug reports and historical transactions help improve the reviewer. Security reports belong in a private advisory.",
  issueLabel: "Report a bug",
  issueNote: "GitHub issues are public. Do not include keys, recovery phrases or confidential transaction data.",
  securityLabel: "Report a vulnerability",
  securityNote: "Private GitHub reporting for suspected security vulnerabilities.",
  credit: { prefix: "Layout after", name: "daoism.systems", href: "https://daoism.systems" },
  licence: "MIT OR Apache-2.0",
  privacy: "Privacy",
} as const;

export const SOCIALS = [{ label: "GitHub", href: REPO_URL, icon: "github" }] as const;

export const PRIVACY = {
  title: ["Privacy"],
  updated: "29 September 2026",
  paragraphs: [
    "This site sets no cookies, runs no analytics and loads nothing from anyone else. The fonts are served from here. The sound is synthesised in your browser.",
    "This site does not collect contact details. Support links open GitHub, where public issues and private security advisories are handled under GitHub's privacy policy.",
    "The ClearSign decoder works locally. The application's optional fetch-by-hash feature contacts Safe's transaction service. Review history is kept in local storage on the computer running the app.",
  ],
} as const;

export const NOT_FOUND = {
  code: "404",
  title: "Nothing here decodes",
  body: "This address points at no page. The bytes are fine; the route is not.",
  back: "Go home",
  backNote: "Everything readable is there.",
  tracker: ["Error", "Void"],
  hint: "Still here? Try",
} as const;
