import fs from 'fs';
import path from 'path';

import { isObject } from './';

export default (() => {
    const PKG_DATA = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, '..', '..', 'package.json'),
            'utf8',
        ),
    );
    if (isObject(PKG_DATA) && typeof PKG_DATA.name === 'string') {
        return PKG_DATA.name;
    }
    return '@sounisi5011/metalsmith-netlify-published-date';
})();
