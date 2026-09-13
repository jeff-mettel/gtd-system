// @gtd/ledger — public API. See README.md.
export { fold, wikiStub, slug, defaultProposal, toDate } from './fold.js';
export { validate, EVENT_TYPES, SPEC, ACTOR_RULES, ACTOR_RE, ACCEPT_KINDS, CONFIG_KEY_RE, DEFAULT_CONFIG, LEDGER_VERSION } from './schema.js';
export { upcast, LedgerTooNew } from './upcast.js';
export { newId, now } from './ids.js';
export { demoEvents, DEMO_TODAY } from './demo.js';
