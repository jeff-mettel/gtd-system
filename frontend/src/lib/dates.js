// Dates. Demo "today" is Mon 14 Sep 2026; all example dates are relative to it.

import { delegated } from '../model.js';
import { state } from '../state.js';
import { toast } from '../ui/nav.js';

<aside class="drawer" id="drawer" aria-label="Detail"></aside>
<div class="toast" id="toast"></div>
<div class="tip" id="tip"></div>

    const dg = state.delegated[it.id];
    if (dg) { if (dg.status === 'taken') { delete it.owner; delete it.del; } else { it.owner = 'ai'; it.cap = it.cap || dg.cap; it.del = Object.assign({}, it.del || {}, dg); if (dg.status === 'approved') it.kind = 'done'; if (dg.status === 'working') { it.del.status = 'ready'; it.del.readyAt = it.del.readyAt || TODAY; it.del.deliverable = it.del.deliverable || `${it.next}\n\n(Finished while you were away — in the live system the assistant's output appears here.)`; } } }

/* ---------- helpers ---------- */
