module.exports = options => {
  return function pluginEchoOpts(files, metalsmith, done) {
    files.options = options;
    done();
  };
};
