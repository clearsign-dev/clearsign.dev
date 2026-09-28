# ClearSign — everything a website needs to say

This is the source material for building clearsign's public site. It is written
to be handed to whoever or whatever builds it. Every number and claim in it
comes from the repository and can be checked there; nothing is aspirational
unless it is marked as such.

---

# PART 1 — THE ONE-PARAGRAPH VERSION

**ClearSign reads a blockchain transaction from the raw bytes and tells you what
those bytes actually do, before you approve them.** It does this with no network
access, no knowledge of your wallet, and no input from any service — including
the one that showed you the transaction in the first place. It does not hold
keys and it does not sign for you; your existing hardware wallet still does that.
It adds one step before you click approve, and that step is the difference
between reading a description of a transaction and reading the transaction.

---

# PART 2 — THE PROBLEM, IN FULL

## What people actually see when they sign

A person approving a high-value transaction on a shared Safe sees two things:

1. **A summary in a web interface.** Safe{Wallet} shows a decoded, human-readable
   description of what the transaction does. That description is produced by a
   service — it is *about* the transaction, not the transaction itself.
2. **A hash on a hardware wallet screen.** A 32-byte number. It is exact, and it
   is unreadable. Nobody verifies a hash by eye against anything, because there
   is nothing to verify it against.

Neither is the transaction. The first can be wrong or tampered with. The second
is correct and useless. The gap between them is where the money goes.

## What happened to Bybit

On **21 February 2025**, Bybit lost approximately **$1.5 billion** in the largest
theft in the history of cryptocurrency.

The signers were not careless. They followed process. Every one of them opened
the Safe{Wallet} interface and saw what looked like an ordinary ERC-20
`transfer` — the selector `0xa9059cbb`, which is the most common function call
on Ethereum. They approved it on their hardware wallets.

The web interface had been tampered with. What they actually approved was a
**DELEGATECALL** — an operation that runs someone else's code *as though it were
the Safe itself*, with the Safe's own storage and its own balance. The attacker
replaced the Safe's implementation and drained it.

The concrete details, all verifiable on-chain:

| | |
|---|---|
| Safe address | `0x1Db92e2EeBC8E0c075a02BeA49a2935BcD2dFCF4` |
| Nonce | 71 |
| Safe transaction hash | `0xb3476d061aeb8fc1d605a873c483a2402d88a68a9cdd1a8b47655dd55ba004f8` |
| Operation | `DELEGATECALL` (operation byte 1, not 0) |
| Code that ran as the Safe | `0x96221423681A6d52E184D440a8eFCEbB105C7242` |
| Selector shown | `0xa9059cbb` — `transfer(address,uint256)` |

ClearSign reads that transaction and answers `[CRITICAL] SAFE_DELEGATECALL` and
`DO NOT SIGN`. The record it reads is not a reconstruction: it was pulled from
Safe's own production transaction service and lives in the repository as a test
fixture, with the `curl` command that fetched it, so anyone can repeat it.

## Why this is structural, not a one-off

The Bybit signers could not have caught it with more care. There was nothing on
their screens to be careful about. The failure is that **the thing describing the
transaction and the thing executing the transaction are different things**, and
only one of them is under attack.

This recurs. Every interface that decodes a transaction for you — a wallet, a
block explorer, a multisig front end — is a piece of software that can be
compromised, and its output is not derived from the bytes you are signing. As
long as signing means trusting a description, the description is the target.

---

# PART 3 — WHAT CLEARSIGN IS

## The guarantee, stated exactly

> **What you see on this screen is derived only from the exact bytes being
> signed. It was computed by code you can reproduce bit-for-bit from public
> source. It ran on a machine with no network, no browser, and no other
> software.**

Three separate promises, and each is checkable:

1. **Derived only from the bytes.** No labels, no token names, no "description"
   from the untrusted side is ever shown. If Safe's API says the transaction is
   a transfer, ClearSign ignores that field entirely and decodes the calldata
   itself.
2. **Reproducible from public source.** Two builds of the same source in the
   named canonical environment produce byte-identical binaries.
3. **No network, no browser, nothing else.** In the signer image, the operating
   system contains exactly one program and the kernel is built without a network
   stack at all — not disabled, absent.

## What it is not

It is not a wallet. It does not hold your keys. It does not sign your
transactions on your everyday computer, and the commands that could are locked
behind an environment variable specifically so nobody does that by accident. It
does not talk to a blockchain. It reads, and it reports.

## Who it is for

Three groups, in order of how badly they need it:

1. **Multisig signers** at protocols, DAOs, funds and exchanges who approve Safe
   transactions. This is the Bybit population.
2. **Security-conscious individuals** holding meaningful value, who already use a
   hardware wallet but in practice approve opaque data they cannot read.
3. **Auditors and incident responders** who need to establish, independently of
   any web interface, what a pending transaction really does.

**Explicitly not for:** people who want a private everyday phone. GrapheneOS
already serves them well, and this project has no intention of competing there.
Saying so plainly is part of the positioning.

---

# PART 4 — WHAT IT ACTUALLY READS

## Transaction formats

- Unsigned EVM transactions: **EIP-1559 (type 2)** and **legacy**, parsed with
  strict canonical RLP. Non-canonical encodings and trailing bytes are rejected
  rather than tolerated.

## Calldata it decodes

**ERC-20**
- `transfer`, `transferFrom`, `approve`
- Unlimited-approval detection: an approval large enough to be effectively
  unlimited (≥ 2^192) is named as unlimited, not rendered as a number nobody
  counts the digits of

**Safe multisig**
- `execTransaction`, including the inner call and its operation type — this is
  where DELEGATECALL is caught
- The **Safe transaction hash recomputed locally** from the bytes, so signers can
  compare it out of band with each other and with their hardware wallet screens
- The Safe domain is worked out from the record or the file is refused. A
  **v1.1.x domain omits the chain ID**, which makes the signature replayable on
  another chain; that is reported as CRITICAL rather than quietly signed

**Safe administration** — every one of these is CRITICAL:
`changeMasterCopy`, `addOwnerWithThreshold`, `removeOwner`, `swapOwner`,
`changeThreshold`, `enableModule`, `disableModule`, `setGuard`,
`setFallbackHandler`

**Batched calls**
- Safe `multiSend(bytes)` batches are unpacked and **every inner call is shown**
- Only at the **11 MultiSend deployments Safe publishes**, and only on the
  **1,404 address-chain pairs** they publish them for, taken from
  `safe-global/safe-deployments` and re-checked against their published EIP-55
  strings
- A delegatecall inside a batch, an unpinned batching contract, a published
  address on an unpublished chain, a truncated batch and an over-long batch all
  stay CRITICAL and undecoded

**Air-gapped QR transport**
- Reads signing requests the way a real air-gapped device does: **Uniform
  Resources** (BCR-2020-005, Bytewords BCR-2020-012) with **multipart fountain
  codes** (BCR-2024-001), carrying **EIP-4527** `eth-sign-request` in and
  `eth-signature` out
- This is the format **MetaMask and Keystone already speak**, tested against
  Keystone's own `@keystonehq/bc-ur-registry-eth` library
- What the wallet *claims* is checked against the signed bytes: the chain ID it
  states, the address it expects, and the wallet it names by BIP-32 master
  fingerprint. Disagreements refuse. A claim the wallet omits is reported rather
  than passed over — **a check nobody can fail is not a check**

**AI agent plans** (the authority engine)
- An agent proposes a plan of small typed steps; the engine validates it, traces
  where data would flow, classifies risk, and requires a person to approve each
  finding by name
- **The planner does not get to classify its own data.** A proposal can label
  something "public"; local policy decides. A step that would carry a secret off
  the device is CRITICAL even when the proposal says otherwise
- The worked example is an ordinary "summarise my notes" task with two injected
  steps. Every step looks routine; the plan does not. Exit code 3, and the
  reason is named: secret data would leave the device through a web request

## How it reports

Four severities: **INFO**, **WARNING**, **CRITICAL**, and **BLIND** for anything
it does not fully understand.

Exit codes, so it can be scripted: `0` nothing alarming, `2` something could not
be decoded, `3` something CRITICAL.

**BLIND or CRITICAL always ends in `DO NOT SIGN`.** Signing requires
acknowledging *exactly* the set of BLIND and CRITICAL findings, one by one —
not more, not fewer, not duplicates.

---

# PART 5 — HOW IT SHIPS

The same Rust core, in three shapes.

## 1. Desktop application

- **macOS, Windows and Linux**, built from the same core (Tauri; identifier
  `com.anticsdecoded.clearsign`, version 0.1.0)
- Paste a transaction, drop a file, or **fetch a queued one by its Safe
  transaction hash**
- **12 networks**: Ethereum, Arbitrum, Optimism, Polygon, Base, Gnosis,
  Avalanche, BNB, Celo, Scroll, Linea, Sepolia
- Safe version handled explicitly: worked out from the hash, or v1.1.x, or
  v1.3.0+
- Review history kept locally in the browser storage of the app itself; nothing
  is sent anywhere
- A copyable record to hand to the other signers
- **Status: builds on all three platforms, but is not yet code-signed or
  notarised.** Say this.

## 2. Command-line tool

```sh
clearsign safe-json tx.json --chain-id 1      # read Safe's own JSON export
clearsign safe-tx --safe 0x… --nonce 71 …     # read a transaction field by field
clearsign qr-review scanned-codes.txt         # read an animated QR request
clearsign qr-sign …                           # reply with an eth-signature
clearsign address / derive                    # key inspection (dev-gated)
```

- Reads Safe's own JSON export directly, and **ignores its `dataDecoded` field**
  on principle
- Agrees with Safe's own service on the transaction hash — checked against the
  real Bybit record
- Safe to run on any computer, because reviewing is read-only

## 3. Signer-only operating system image

- A **Linux image whose entire userland is one program**. The signer is process
  1 and there is nothing else in it
- The kernel is **built without a network stack** — not unconfigured, absent
- **Five build-time gates** refuse: a kernel with networking, a kernel with
  modules, a dynamically linked signer, more than one regular file, or anything
  named or containing a shell
- **The gates are proven to work**: two violations were planted deliberately — a
  shell copied into the root filesystem, and networking re-enabled in the kernel
  config. Gate 4 caught the first, gate 1 the second. Both reverted
- Boots in QEMU **with no network device attached**, reads a request produced by
  another wallet's implementation, decodes it, refuses a key the request did not
  ask for, and signs with the one it did

### And the compartment prototype above it

- **seL4** (Microkit 2.3.0) — the formally verified microkernel — running an
  untrusted Linux guest (libvmm 0.2.0) beside the signer
- The Linux compartment **has no serial device and no shell**. Its writes to the
  UART trap to the virtual machine monitor, which relays them one line at a time
  behind a `GUEST|` prefix with anything non-printable replaced, so it cannot
  move the cursor or clear the screen. **There is no receive path at all**: the
  compartment runs a fixed script and is read, not typed into
- Linux then tries to use kernel privileges to write the review region, and
  **seL4 blocks it**. That is the demonstration
- **GrapheneOS `hardened_malloc`**, built at the GrapheneOS-manifest-pinned
  commit, runs as the system allocator in that compartment and **aborts a
  write-after-free that glibc misses**
- Prompt injection blocked across compartments: the Linux side writes an
  assistant's plan into shared memory, the signer side decodes it, traces the
  flow and answers CRITICAL `SECRET_EGRESS`. The verdict is read from a line
  only the signer can write

**Status: this runs under emulation. There is no hardware.** Say this too.

---

# PART 6 — THE TWELVE INVARIANTS

These are the project's own stated rules. Each has named tests. They make
excellent site content because they are specific and falsifiable.

| | |
|---|---|
| **INV-1** | Every value shown is derived only from the bytes being signed. No labels, token names or descriptions supplied by the untrusted side are ever displayed |
| **INV-2** | Nothing is signed silently. Anything the decoder cannot fully interpret produces an explicit BLIND finding |
| **INV-3** | Decoding is deterministic. The same bytes produce an identical display on every build and platform |
| **INV-4** | Non-canonical or trailing-garbage encodings are rejected rather than tolerated |
| **INV-5** | The Safe transaction hash is computed locally and displayed, so signers can compare it out of band |
| **INV-6** | High-risk actions are flagged CRITICAL: delegatecall, changes to the Safe implementation, owners, threshold, modules, guards or fallback handler, and unlimited token approvals |
| **INV-7** | The decoder never panics on any input. Every failure is a typed error |
| **INV-8** | The signer image contains no network stack |
| **INV-9** | Release builds are reproducible from public source |
| **INV-10** | Nothing can be signed except a digest attached to a review. The digest is recomputed from the reviewed bytes, never taken from the caller. **There is no API that signs a raw hash** |
| **INV-11** | No seed is ever generated from a hardware random number generator alone. Seeds come from at least 99 dice rolls, or hardware entropy mixed with at least 50, so a silently broken generator cannot compromise them |
| **INV-12** | Every signature is verified by public-key recovery, and checked to be low-S, before it is released |

---

# PART 7 — THE EVIDENCE

Everything here is reproducible from the repository.

## Testing

| | |
|---|---|
| Tests | **170**, across the workspace |
| Fuzzing | **7 cargo-fuzz targets** with security properties asserted on every input. Roughly 92M executions on the decoder, 47.5M on the batch decoder, 103.8M on the QR reader, 56M on the plan format, 6.5M on the authority engine. **Zero failures** |
| Differential testing | Against **alloy**, an independent implementation: 6 properties × 3,000 random cases — EIP-1559, legacy, Safe EIP-712 hashes, ERC-20 and `execTransaction` calldata |
| Never more permissive | Whenever ClearSign accepts mutated `execTransaction` calldata, alloy's validating decoder must accept it *and* re-encode it identically |
| Test vectors | All **24 official BIP-39 English vectors**. Addresses, signatures, dice-roll phrases and a signed EIP-1559 transaction all compared against Foundry's `cast` |
| Spec conformance | Bytewords, CRC-32, Xoshiro256\*\*, the Walker-Vose sampler, the degree chooser, the Fisher-Yates shuffle, fragment lengths and part CBOR each checked against the vectors published in BCR-2020-012 and BCR-2024-001 |
| Static guarantees | `clippy` denies indexing, `unwrap`, `expect`, `panic` and unchecked arithmetic in the decoder and key crates. `unsafe` is **forbidden** |
| Portability | The decoder and key crates build for `aarch64-unknown-none` and `thumbv7em-none-eabihf` — with no operating system at all |

## The tests are proven to be able to fail

This is the most persuasive thing the project has, and most sites would never
think to say it. Bugs were **planted deliberately** to check the tests catch
them:

- Decode any delegatecall target → caught
- Ignore each batch element's operation byte → caught
- Ignore the chain ID → caught
- Swap fields in the Safe hash → caught, with a minimal failing input
- Tolerate trailing bytes → caught
- Skip the Bytewords CRC-32 → **not caught**. That exposed a test passing for the
  wrong reason. The test was rewritten to corrupt a payload byte into a
  *different valid word*, and then it caught the bug
- Accept parts from a different message → caught
- Ignore the address the request names → caught
- Ignore the step-count limit → caught
- Accept a non-canonical plan encoding → **not caught**, and 30 million further
  fuzzing runs found no input where it would fire, because the format's
  fixed-width integers and length prefixes already make each encoding unique.
  The check stays as a guard for future fields and is **documented as defensive
  rather than as something the tests cover**

Two honest gaps, both named in the project's own documentation rather than
buried. That is the tone the whole site should have.

## Reproducible builds

- Two builds in the pinned Debian image, differing in build path, locale,
  timezone, umask, hostname and container instance, produce **identical
  `aarch64-unknown-linux-musl` binaries**. The signer image embeds that exact
  binary and the build refuses any other
- The signer image itself reproduces: identical kernel and identical initramfs.
  This exposed a real defect — GNU cpio's `--reproducible` still recorded each
  file's mtime, so the same content hashed differently every build. Fixed by
  zeroing mtimes before archiving
- The Linux guest kernel reproduces bit-for-bit in a brand-new build volume
- **Across compiler hosts it does not reproduce, and this was measured rather
  than assumed.** The same source and the same Rust 1.98.1, hosted on macOS
  instead of Linux, produces identical `.rodata`, `.data`, `.got`,
  `.gcc_except_table` and `.init_array`, and a **different `.text`**. rustc makes
  no cross-host determinism promise, so — as GrapheneOS, Tor Browser and Debian
  all do — the project names **one canonical environment** instead of claiming
  more

## Supply chain

- Every borrowed component is fetched and verified from a single pinned
  configuration file
- seL4 Microkit SDK 2.3.0: SHA-256 pinned, **GPG signature verified** against a
  pinned key
- Linux kernel **6.18.52 LTS** from kernel.org, signature checked against Greg
  Kroah-Hartman's key from kernel.org's own key directory
- GrapheneOS release **2026091000**: manifest tag signature verified against a
  pinned key fingerprint, **1,057 projects all pinned to commit hashes**
- BusyBox 1.37.0 and glibc 2.41 from apt-verified Debian packages

## External review

**One** external security audit, **17 September 2026**. **Ten findings. All ten
reproduced independently and all ten closed.** Their list of further *leads* is
still open and is documented as the best starting point for a second pass.

---

# PART 8 — WHAT IS NOT TRUE YET

**This section is mandatory.** The project's own documents name gaps rather than
hide them, and the site must match. It is also, commercially, the most
trust-building thing on the page — and the exact opposite of what every
competitor does.

| | |
|---|---|
| **Users** | **Zero.** Nobody outside the project has run this on a real transaction. This is the number that matters |
| **Review** | One audit. **Nine of the ten fixes changed signing-critical code that nobody outside has read since** |
| **Hardware** | None. No hardware root of trust, no verified boot, no secure element |
| **Emulation** | Everything runs under QEMU. An emulator has no secure element and no verified boot |
| **Code signing** | The application is unsigned and un-notarised on every platform |
| **Reproducibility** | Proven on one machine and in one canonical environment. A second physical machine has not run it |
| **EIP-712 typed data** | **Not covered**, beyond the Safe transaction type itself. The reviewer refuses it, which is honest and increasingly limiting. It is the first thing on the v2 list |
| **Chains** | EVM only. No Bitcoin, no PSBT |
| **Protocols** | No Permit2, no Uniswap, no bridges, no token metadata, no address books. The v1 selector set is deliberately **closed** |

The standing warning, which should appear near any download:

> **Early development. Unaudited beyond one review. Not for real funds.**
> Reviewing a transaction is safe on any computer. The signing and seed commands
> are locked behind an environment variable, because a recovery phrase typed into
> an everyday machine must be treated as exposed.

---

# PART 9 — THE LONGER ARC

Worth one section on the site, clearly marked as direction rather than product.

Every major operating system is converging on AI agents that act for the user:
reading files, sending messages, making purchases, moving money. **The agent is
the new untrusted web interface.** A prompt-injected agent is the Bybit attack
generalised to everything a computer can do.

The position:

> **An operating system where intelligence proposes, and a human approves exactly
> what will happen, before anything irreversible happens.**

```
goal → planner (AI, untrusted) → plan of small typed steps
                                      ↓
     authority engine: validate → trace data flow → classify risk
                                      ↓
              plain-language review, broken into simple chunks
                                      ↓
        human approves the exact plan fingerprint + the named risks
                                      ↓
     executor runs ONLY that plan, with only the capabilities it declared
```

Breaking complexity into simple chunks is not a presentation layer on top — it
**is** the security model. A task the system cannot break into typed, reviewable
steps is a task it will not perform silently.

This part already exists in the repository as the authority engine, with 18
tests, a wire format with 11 more, an agent adapter with 10, and 20,000 random
plans. It is not vapour; it is early.

---

# PART 10 — BRAND AND ASSETS

| | |
|---|---|
| Name | **ClearSign**, one word, capital C and capital S |
| Repository | `github.com/AnticsDecoded/clearsign` |
| Licence | MIT OR Apache-2.0 |
| Mark | A **C as an aperture** — the thing you look through — with an **S inside it as a signature stroke**. The C has flat-cut terminals because it is an instrument; the S has rounded ones because it is a pen. Both are arcs on the same grid |
| Mark files | `brand/clearsign-mark.svg` (mark alone), `brand/clearsign-icon.svg` (on its rounded field, the app icon), `brand/clearsign-wordmark.svg` (mark plus name). All generated by `brand/make-mark.py`, so they are exact at any size |
| Accent colour | `#2d6a8a` on light, `#4aa3c9` on dark |
| Signature colour | The page's own ink — near-black on light, near-white on dark |
| Typefaces | **IBM Plex Sans** for text, **IBM Plex Mono** for code, hashes and addresses |

The mark takes its three colours from CSS variables (`--mark-c`, `--mark-s`,
`--mark-gap`), so it belongs *in* a page rather than being a picture pasted onto
one. Set `--mark-gap` to the page background or the S will merge into the C.

---

# PART 11 — WRITING RULES

**Tone.** Plain, exact, unhurried. The subject is frightening enough without
adjectives. No "revolutionary", "cutting-edge", "military-grade",
"bank-grade", "unhackable". No exclamation marks.

**Always name the gaps.** This is the single strongest differentiator. Every
competitor's site is a list of strengths. This one says what has not been proven,
and that is why the strengths are believable.

**Never claim:**
- that it is audited, production-ready, or safe for real funds
- that it holds keys, signs for you, or replaces a hardware wallet
- that it has users, customers or partners
- that it runs on hardware
- that it covers EIP-712, Bitcoin, or any protocol outside the closed v1 set
- any number not in this document

**Always include:** the "early development, not for real funds" warning near any
download or install instruction.

**Prefer concrete over abstract.** "It caught the real Bybit transaction, and the
fixture came from Safe's own API" beats "trusted by security professionals"
— which would also be false.

**Numbers that are safe to use:** 170 tests, 7 fuzz targets, ~306 million total
fuzz executions, 12 invariants, 11 pinned MultiSend deployments, 1,404
address-chain pairs, 12 networks, 1 external audit, 10 findings, 10 closed, 24
BIP-39 vectors, 1,057 pinned GrapheneOS projects, 5 image build gates, 0 users,
0 network calls while reviewing, ~$1.5bn Bybit, 21 February 2025, nonce 71.

---

# PART 12 — SUGGESTED SECTION ORDER

If the design being cloned is a full-screen, section-by-section site, this order
works:

1. **Opening** — the one-line promise and what it is
2. **The problem** — Bybit, and why it is structural
3. **What it reads** — the coverage list, best as an accordion
4. **Proof** — the real Bybit transaction and ClearSign's actual output
5. **Evidence** — the testing numbers, *including a tab or panel for what is not
   true yet*
6. **How it ships** — desktop app, command line, signer image
7. **Get it** — downloads, with the warning
8. **Contact** — "tell us what it missed" is a better call to action than "get in
   touch", because the most useful thing anyone can send is a transaction this
   read badly

---

# PART 13 — READY-TO-USE COPY

Lines that can be dropped in as written.

**Headline options**
- See exactly what you are about to sign
- Read the bytes, not the description
- The transaction, not a summary of it

**Sub-headline**
> ClearSign reads the transaction in front of you and tells you what those bytes
> actually do — from the bytes alone. No network access, no knowledge of your
> wallet, and no opinion from any service, including Safe's own.

**The problem, short**
> Your hardware wallet shows you a hash. Your multisig interface shows you a
> summary produced by a service. Neither of those is the transaction — they are
> descriptions of it, and a description can be wrong. On 21 February 2025 that
> gap cost Bybit about $1.5 billion.

**The problem, shorter**
> Nobody reads the bytes. ClearSign does.

**On the audit**
> One external review, ten findings, all ten reproduced and all ten closed. Nine
> of those fixes changed signing-critical code that nobody outside the project
> has read since. That is why there is a second review on the roadmap and not a
> badge on this page.

**On having no users**
> Zero users. That is the number that matters, and it is on this page for the
> same reason everything else is.

**On the signer image**
> An operating system containing exactly one program, on a kernel built without a
> network stack. Not disabled. Absent.

**On the QR transport**
> What the wallet claims is checked against what the bytes say. The chain it
> names, the address it expects, the wallet it says it is. Disagreements refuse.
> A claim the wallet leaves out is reported rather than passed over, because a
> check nobody can fail is not a check.

**On the agent engine**
> The planner does not get to say how sensitive its own data is.

**Call to action**
> Run it before you approve. Reviewing is safe on any computer.

---

# PART 14 — ONE NOTE ON THE REFERENCE SITE

If the design being copied is `daoism.systems`: **that site is offline.** Its DNS
still resolves to Vercel at `76.76.21.21`, but nothing answers on any port, from
any network — verified 27 and 28 September 2026. A browser will show a blank
page or a connection error, and no browser automation can change that.

Its design is recoverable from the Internet Archive. The capture at
`20230513083430` kept the full stylesheet (`_next/static/css/8eb4802be5bfb777.css`,
111 KB of CSS modules, so every rule is labelled with the component it came from)
and the JavaScript bundles. The capture at `20260613065801` kept the later HTML
shell. Four chunk filenames are byte-identical across the two, and those
filenames are content hashes, so it is the same build three years apart.

For reference, what that site actually was: a full-screen **stage rather than a
scroll** — sections stacked absolutely at `100%` × `100%`, only one active,
switching by `opacity .4s ease-out` and `transform: scale(.95) → scale(1)` over
`.8s`. Root font size `0.9vw` on desktop, so everything scales with the window;
`100%` below 992px and `80%` below 378px. Background: Three.js `WebGLRenderer`
with a `ShaderMaterial` over simplex noise. Palette `#040404` ground, `#fff`
text, `#cacaca` secondary, `#ffdf37` accent. Type: Russo One display, Outfit
body. Per-letter reveal on a `blink` keyframe with three different
cubic-béziers. Rings rotating at 30s, 40s, 45s and 145s. Swiper for sliders.
