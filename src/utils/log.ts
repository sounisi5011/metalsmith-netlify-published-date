import createDebugger from 'debug';

import PKG_DATA from '../../package.json';

export const debug = createDebugger(PKG_DATA.name);
