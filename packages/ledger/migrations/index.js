// Upcasters in order. Add `v2.js` ({ to: 2, up }) here when the shapes change; never rewrite the file on disk.
import v1 from './v1.js';

export const MIGRATIONS = Object.freeze([v1]);
