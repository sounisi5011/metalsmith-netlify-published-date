const cheerio = require('cheerio');

module.exports = contents => {
  try {
    const $ = cheerio.load(contents.toString());

    const $timeElems = $('time').filter(':not([class]), [class=""]');

    // Note: If the file contents is not valid HTML, cheerio will not throw an error.
    //       However, the number of detected "time" elements will be 0.
    if (1 <= $timeElems.length) {
      $timeElems.each((index, element) => {
        const $time = $(element);
        $time.empty();
        if ($time.is('[datetime]')) {
          $time.attr('datetime', '');
        }
      });
      return Buffer.from($.html());
    }
  } catch (err) {}

  return contents;
};
