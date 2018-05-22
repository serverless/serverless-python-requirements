const isWsl = require('is-wsl');

/**
 * Get commands to slim the installed requirements
 * only for non-windows platforms:
 * works for docker builds and when run on UNIX platforms (wsl included)
 * @param {Object} options
 * @param {string} folderPath
 * @return {Array.<String>}
 */
function getSlimPackageCommands(options, folderPath) {
  let stripCmd = [];
  if (process.platform !== 'win32' || isWsl) {
    stripCmd = [
      `&& find ${folderPath} -name "*.so" -exec strip {} \\;`,
      `&& find ${folderPath} -name "*.py[c|o]" -exec rm -rf {} +`,
      `&& find ${folderPath} -type d -name "__pycache__*" -exec rm -rf {} +`,
      `&& find ${folderPath} -type d -name "*.dist-info*" -exec rm -rf {} +`
    ];
  }
  return stripCmd;
}

module.exports = {
  getSlimPackageCommands
};
