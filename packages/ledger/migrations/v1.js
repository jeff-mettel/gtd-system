// v0 → v1. Events written before the contract existed carry no `v`; this stamps them. Identity otherwise.
// A migration module exports { to, up(event) }: `up` receives one event at version `to - 1` and returns the
// event at version `to` (or an array of events, or null to drop it). Never mutate the input.
export default {
  to: 1,
  up: (e) => ({ ...e, v: 1 }),
};
