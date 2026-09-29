// Every word on the site. Sourced from docs/website-brief.md (in the repository
// root); every number here is one the brief lists as safe in Part 11. Section
// components render this and never write their own copy.
//
// The brief's "never claim" list binds everything below: nothing here says the
// project is audited, production-ready or safe for real funds; that it holds
// keys or signs for anyone; that it has users, customers or partners; that it
// runs on hardware; or that it covers EIP-712, Bitcoin or anything outside the
// closed v1 set.

export const REPO_URL = "https://github.com/AnticsDecoded/clearsign";
export const RELEASES_URL = `${REPO_URL}/releases`;
// The address the contact form writes to. It opens the reader's own mail
// client; nothing is posted anywhere. Replace before publishing.
export const CONTACT_EMAIL = "hello@clearsign.dev";

export const WARNING = {
  label: "Before you download",
  headline: "Early development. Unaudited beyond one review. Not for real funds.",
  body: "Reviewing a transaction is safe on any computer. The signing and seed commands are locked behind an environment variable, because a recovery phrase typed into an everyday machine must be treated as exposed.",
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
  heading: ["See exactly", "what you are", "about to sign"],
} as const;

// 1 — The problem. Anatomy: the reference About.
export const PROBLEM = {
  heading: ["Nobody reads", "the bytes"],
  paragraphs: [
    "Your hardware wallet shows you a hash. Your multisig interface shows you a summary produced by a service. Neither of those is the transaction.",
    "They are descriptions of it, and a description can be wrong. On 21 February 2025 that gap cost Bybit about $1.5 billion.",
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
        "ERC-20 transfer, transferFrom and approve",
        "Unlimited approvals named as unlimited",
        "Safe execTransaction, with the inner call and its operation",
        "The Safe transaction hash, recomputed locally",
        "Nine Safe administration calls, every one CRITICAL",
      ],
    },
    {
      title: "Batches, QR and agents",
      summary: "What arrives by batch, camera or assistant",
      items: [
        "MultiSend batches, with every inner call shown",
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
  heading: ["It caught", "Bybit"],
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
      "The record came from Safe's own production transaction service. It lives in the repository as a test fixture, with the curl command that fetched it.",
  },
  severities: [
    { severity: "INFO" as Severity, text: "Nothing alarming" },
    { severity: "WARNING" as Severity, text: "Worth a second look" },
    { severity: "CRITICAL" as Severity, text: "Delegatecall, owner, module or guard changes, unlimited approvals" },
    { severity: "BLIND" as Severity, text: "Anything it does not fully understand" },
  ],
  exitCodes: "Exit 0: nothing alarming. Exit 2: could not be decoded. Exit 3: something CRITICAL.",
} as const;

// 4 — Evidence. Anatomy: the reference Blog slider.
export const EVIDENCE = {
  heading: ["The evidence"],
  description:
    "Everything here is reproducible from the repository, including the part about what is not true yet.",
  slides: [
    {
      kicker: "Testing",
      figure: "170",
      title: "Tests across the workspace",
      body: "Twelve invariants, each with named tests. All 24 official BIP-39 English vectors.",
    },
    {
      kicker: "Fuzzing",
      figure: "~306M",
      title: "Fuzz executions, zero failures",
      body: "Seven cargo-fuzz targets with security properties asserted on every input.",
    },
    {
      kicker: "Differential",
      figure: "6 × 3,000",
      title: "Checked against alloy",
      body: "An independent implementation. Whenever ClearSign accepts mutated calldata, alloy must accept it and re-encode it identically.",
    },
    {
      kicker: "Planted bugs",
      figure: "2",
      title: "Not caught, and written down",
      body: "Bugs were planted to prove the tests can fail. Two got through. One exposed a test passing for the wrong reason, and was fixed. The other is documented as defensive.",
    },
    {
      kicker: "Reproducible",
      figure: "1",
      title: "Canonical build environment",
      body: "Two builds produce identical binaries. Across compiler hosts they do not, and that was measured rather than assumed.",
    },
    {
      kicker: "Supply chain",
      figure: "1,057",
      title: "GrapheneOS projects pinned",
      body: "Every borrowed component fetched and verified from one pinned file. Signatures checked against pinned keys.",
    },
    {
      kicker: "Review",
      figure: "10 / 10",
      title: "Findings closed",
      body: "One external review, ten findings, all reproduced and closed. Nine of those fixes changed signing-critical code nobody outside has read since.",
    },
    {
      kicker: "Not true yet",
      figure: "0",
      title: "Users",
      body: "No hardware root of trust. Everything runs under emulation. Binaries unsigned. No EIP-712. EVM only.",
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
      detail: "Reads Safe's own JSON export and ignores its dataDecoded field on principle. Exit codes for scripts.",
      status: "Read-only",
      icon: "terminal",
    },
    {
      id: "03",
      name: "Signer image",
      detail: "A Linux image whose entire userland is one program, on a kernel built without a network stack. Not disabled. Absent.",
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
      body: "clearsign safe-json tx.json --chain-id 1. Reviewing is read-only and safe on any computer.",
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
  lead: "The most useful thing anyone can send is a transaction this read badly.",
  fields: {
    name: { label: "Name", placeholder: "Your name or alias" },
    email: { label: "Email", placeholder: "you@example.com" },
    message: { label: "Message", placeholder: "Paste the transaction, or say what it got wrong" },
  },
  submit: "Send",
  submitCursor: "Open mail",
  errors: {
    required: "Required",
    email: "That doesn't look like an email address",
  },
  sentNote: "Your mail client should have opened with this message in it.",
  credit: { prefix: "Layout after", name: "daoism.systems", href: "https://daoism.systems" },
  licence: "MIT OR Apache-2.0",
  privacy: "Privacy",
} as const;

export const SOCIALS = [{ label: "GitHub", href: REPO_URL, icon: "github" }] as const;

export const PRIVACY = {
  title: ["Privacy"],
  updated: "28 September 2026",
  paragraphs: [
    "This site sets no cookies, runs no analytics and loads nothing from anyone else. The fonts are served from here. The sound is synthesised in your browser.",
    "The contact form does not send anything. It opens your own mail client with the message filled in, and you decide whether to send it.",
    "ClearSign itself makes no network calls while reviewing a transaction. The desktop app keeps its review history in its own local storage and sends it nowhere.",
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
