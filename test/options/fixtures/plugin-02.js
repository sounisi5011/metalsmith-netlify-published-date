const path = require('path');

const name = path.basename(__filename);

function plugin02(files, metalsmith, done) {
  Object.entries(files).forEach(([filename, filedata]) => {
    if (filedata.hasOwnProperty(name)) {
      filedata[name]++;
    } else {
      filedata[name] = 0;
    }
  });
  done();
}

module.exports = () => plugin02;
