import { defineConfig } from 'vitepress'

// Shared sidebar for the entry point (Introduction, Integrate) and the Reference area.
// Kept in one const so `/` (the fallback) and `/reference/` render the same groups.
const referenceSidebar = [
  {
    text: 'Getting started',
    items: [
      { text: 'Introduction', link: '/introduction' },
      { text: 'Quickstart', link: '/guide/quickstart' },
      { text: 'Integrate', link: '/integrate' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'CLI reference', link: '/reference/cli' },
      { text: 'Machine output', link: '/reference/machine-output' },
      { text: 'Policy (.tamperward.yml)', link: '/reference/policy' },
      { text: 'Exit codes', link: '/reference/exit-codes' },
    ],
  },
  {
    text: 'Concepts',
    items: [
      { text: 'Architecture', link: '/architecture' },
      { text: 'Performance budgets', link: '/PERF' },
      { text: 'Cast inventory', link: '/CAST-INVENTORY' },
      { text: 'Threat model: pristine run', link: '/THREAT-MODEL-pristine-run' },
      { text: 'Threat model: adjudication boundary', link: '/THREAT-MODEL-adjudication-boundary' },
      { text: 'OWASP ACS mapping', link: '/ACS-mapping' },
    ],
  },
]

// Deployed to GitHub Pages at hexrift.github.io/tamperward — `base` must match the
// repo name or every asset 404s. The docs build is a separate workflow (docs.yml);
// nothing here ships in the npm package.
export default defineConfig({
  title: 'Tamperward',
  description:
    'The deterministic agent-integrity gate: blocks AI coding agents from deleting tests, lowering coverage, or rewriting snapshots — measured, not asserted.',
  base: '/tamperward/',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/tamperward/favicon.svg' }]],
  ignoreDeadLinks: false, // a broken link fails the docs build; do not switch this back on to hide one
  themeConfig: {
    // The badge supplies its own background, so the same asset works in either theme.
    logo: '/logo.svg',
    nav: [
      { text: 'Introduction', link: '/introduction' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Reference', link: '/reference/cli' },
      { text: 'Blog', link: '/blog/' },
      { text: 'Research', link: '/research/' },
      { text: 'npm', link: 'https://www.npmjs.com/package/tamperward' },
    ],
    sidebar: {
      // The top-level pages (introduction, integrate, architecture, threat models…)
      // have no path prefix of their own; `/` is the fallback sidebar VitePress uses
      // when no longer prefix matches, so the guide, research and blog groups below
      // still win on their own paths (#451). The `/reference/` pages reuse the same
      // groups so navigation is consistent across the reference area.
      '/': referenceSidebar,
      '/reference/': referenceSidebar,
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Quickstart', link: '/guide/quickstart' },
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'The rules', link: '/guide/rules' },
            { text: 'Enforcement & sign-off', link: '/guide/enforcement' },
            { text: 'Signed verdict statements', link: '/guide/attestation' },
            { text: 'Admission consumer', link: '/guide/admission-consumer' },
            { text: 'Organisation policy floor', link: '/guide/organisation-policy' },
            { text: 'Independent function oracle', link: '/guide/external-oracle' },
            { text: 'Runtime adapters', link: '/guide/runtime-adapters' },
            { text: 'Environment variables', link: '/guide/environment' },
            { text: 'Audit history & stats', link: '/guide/audit' },
            { text: 'Research: evaluate a model', link: '/guide/research' },
          ],
        },
      ],
      '/research/': [
        {
          text: 'Research & Benchmarks',
          items: [
            { text: 'Overview', link: '/research/' },
            {
              text: 'Agent integrity benchmark',
              items: [
                { text: 'Round 1', link: '/research/round-1' },
                { text: 'Round 2', link: '/research/round-2' },
                { text: 'Round 3', link: '/research/round-3' },
                { text: 'Round 3.1', link: '/research/round-3-1' },
                { text: 'Round 4', link: '/research/round-4' },
              ],
            },
            { text: 'Detector precision / false positives', link: '/research/detector-precision' },
            { text: 'Performance / overhead', link: '/research/performance' },
            { text: 'Security and adversarial evaluations', link: '/research/security-evaluations' },
            { text: 'Model comparisons', link: '/research/model-comparisons' },
            { text: 'Methodology, limitations and errata', link: '/research/methodology-limitations-errata' },
            { text: 'Production pilot protocol', link: '/research/pilot-protocol' },
          ],
        },
      ],
      '/blog/': [
        {
          text: 'Blog',
          items: [
            { text: 'All posts', link: '/blog/' },
            { text: 'Limitations', link: '/blog/limitations' },
            { text: 'Errata', link: '/blog/errata' },
            { text: 'Round 4.1 is stalled. The research does not have to be.', link: '/blog/round-4-1-is-stalled-the-research-does-not-have-to-be' },
            { text: "The second runtime didn't qualify. The freeze window closed anyway.", link: '/blog/the-second-runtime-didnt-qualify-the-freeze-window-closed-anyway' },
            { text: "The prevention bet didn't replicate. No surviving tampering was certified clean.", link: '/blog/the-prevention-bet-didnt-replicate-no-surviving-tampering-was-certified-clean' },
            { text: 'How round 4 is built to be hard to fool', link: '/blog/how-round-4-is-built-to-be-hard-to-fool' },
            { text: "The mechanism transferred. The confirmatory result didn't replicate.", link: '/blog/the-mechanism-transferred-the-effect-didnt' },
            { text: 'Before we test the same tasks on a stronger model', link: '/blog/before-we-test-the-same-tasks-on-a-stronger-model' },
            { text: "The effect transferred. The detector didn't.", link: '/blog/the-effect-transferred-the-detector-didnt' },
            { text: 'Before we test Tamperward on Python repositories', link: '/blog/before-we-test-tamperward-on-python-repositories' },
            { text: "The gate held. The runtime didn't.", link: '/blog/the-gate-held-the-runtime-didnt' },
            { text: 'What losing the bet bought', link: '/blog/what-losing-the-bet-bought' },
            { text: 'We tested an AI coding agent across 27 real repositories', link: '/blog/we-tested-an-ai-coding-agent-on-27-real-repositories' },
            { text: 'Before we test Tamperward on 27 real repositories', link: '/blog/before-we-test-tamperward-on-27-real-repositories' },
            { text: 'What agents do when the tests are read-only', link: '/blog/what-agents-do-when-the-tests-are-read-only' },
            { text: '137 runs were not 137 experiments', link: '/blog/137-runs-were-not-137-experiments' },
            { text: 'What agents do when you give the cheat a name', link: '/blog/what-agents-do-when-you-give-the-cheat-a-name' },
            { text: 'What agents do when you just ask nicely', link: '/blog/what-agents-do-when-you-just-ask-nicely' },
            { text: 'What agents do when no one can say no', link: '/blog/what-agents-do-when-no-one-can-say-no' },
            { text: "What agents do when the bug isn't theirs", link: '/blog/what-agents-do-when-the-bug-is-not-theirs' },
            { text: "What agents do when it doesn't look like a test", link: '/blog/what-agents-do-when-it-does-not-look-like-a-test' },
            { text: "What agents do when the fix doesn't exist", link: '/blog/what-agents-do-when-the-fix-does-not-exist' },
            { text: 'What agents do when nothing is watching', link: '/blog/what-agents-do-when-nothing-is-watching' },
            { text: 'What agents do when you block their shortcuts', link: '/blog/what-agents-do-when-you-block-their-shortcuts' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/hexrift/tamperward' }],
    footer: {
      message: 'Apache-2.0. Every headline number is measured; the pre-registered predictions — including the refuted ones — are committed to the repo.',
    },
    search: { provider: 'local' },
  },
})
