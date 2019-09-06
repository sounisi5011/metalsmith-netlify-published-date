const cheerio = require('cheerio');

function isValidDate(date) {
  return !isNaN(date.getTime());
}

function getTime($time) {
  const dateStr = $time.attr('datetime') || $time.text();
  if (dateStr) {
    const date = new Date(dateStr);
    if (isValidDate(date)) {
      return date;
    }
  }
  return null;
}

module.exports = (previewContents, filedata) => {
  try {
    const $ = cheerio.load(previewContents.toString());

    const publishedDate = getTime($('time.published'));
    if (publishedDate) {
      filedata.published = publishedDate;
    }

    const modifiedDate = getTime($('time.modified'));
    if (modifiedDate) {
      filedata.modified = modifiedDate;
    }
  } catch (err) {}
};
