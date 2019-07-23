module.exports = () => (files, metalsmith, done) => {
  Object.values(files).forEach(filedata => {
    const newContents = Object.entries(filedata)
      .filter(([, value]) => value instanceof Date)
      .map(([key, value]) => `${key}: ${value.toISOString()}`)
      .join('\n');
    if (newContents) {
      filedata.contents = Buffer.from(newContents, 'utf8');
    }
  });
  done(null);
};
