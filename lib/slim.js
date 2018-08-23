const isWsl = require('is-wsl');
const glob = require('glob-all');
const fse = require('fs-extra');

const getStripCommand = (options, folderPath) =>
  process.platform !== 'win32' || isWsl || options.dockerizePip
    ? ` && find ${folderPath} -name "*.so" -exec strip {} ';'`
    : '';

const deleteFiles = (options, folderPath) => {
  let patterns = ['**/*.py[c|o]', '**/__pycache__*', '**/*.dist-info*'];
  if (options.slimPatterns) {
    patterns = patterns.concat(options.slimPatterns);
  }
  for (const pattern of patterns) {
    for (const file of glob.sync(`${folderPath}/${pattern}`)) {
      fse.removeSync(file);
    }
  }
};

module.exports = {
  getStripCommand,
  deleteFiles
};
