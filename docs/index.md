---
layout: home

hero:
  name: Tamperward
  text: The deterministic agent-integrity gate
  tagline: AI coding agents optimize for "the command succeeded," not "the change is trustworthy." Tamperward blocks the class of shortcut they take to force checks green — measured, not asserted.
  image:
    src: /logo.svg
    alt: Tamperward
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: See the evidence →
      link: /research/
    - theme: alt
      text: Read the launch post
      link: /blog/what-agents-do-when-you-block-their-shortcuts
    - theme: alt
      text: GitHub
      link: https://github.com/hamsasoftware/tamperward

features:
  - title: Deterministic, no model calls
    details: A ruleset evaluated on the actual diff and commands. There is no LLM judge to persuade — a gate an agent can argue with is not a gate.
  - title: Enforced at every stage, CI the authority
    details: Inside the agent's loop (a Claude Code PreToolUse deny plus an end-of-turn sweep, holding under bypassPermissions), at pre-commit, and in CI — the authority, reading the policy from the merge-base so a PR cannot govern its own verdict.
  - title: Measured, not asserted
    details: The preregistered Round 4 prevention bet did not replicate (b=5 / c=3, exact McNemar p = 0.7266); its separate descriptive security observation found 0 strict tamper bypasses across 201 measured trajectories. Failed predictions ship in the repo beside the confirmed results.
  - title: One command to wire it all
    details: npx tamperward onboard guides the first run — preview, explicit confirmation, verifier acceptance, first verify, posture from doctor — over npx tamperward init, which writes the policy and every enforcement point idempotently, without overwriting anything you wrote.
---
