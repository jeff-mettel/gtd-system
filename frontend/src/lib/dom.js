// Small DOM helpers.

import { wiki } from '../data/example.js';

      it.p = { kind:'action', next:it.next, project: it.project || (wiki[it.refPage] ? it.refPage : null), ctx:'@quick', min:15, conf:.7, why:`Tickler — you asked to revisit this on ${new Date(it.revisit).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}. Decide now: act on it, park it again with a new date, or drop it.` };
    }

    if (i.createdAt) ev.push({ when:new Date(i.createdAt), what:'Next action added', item:i });
