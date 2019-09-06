const sleep = waitSeconds =>
  new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, waitSeconds * 1000);
  });

module.exports = async (_, filedata) => {
  await sleep(5);
  filedata.x = 42;
};
