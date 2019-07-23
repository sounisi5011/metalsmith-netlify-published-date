const metalsmith = require('metalsmith');

metalsmith(__dirname)
    .build(err => {
        if (err) {
            process.exitCode = 1;
            throw err;
        }
    });
