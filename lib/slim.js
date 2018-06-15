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

  // Default stripping is done for non-windows environments
  if (process.platform !== 'win32' || isWsl) {
    stripCmd = getDefaultSLimOptions(folderPath);

    // If specified any custom patterns to remove
    if (options.slimPatterns instanceof Array) {
      // Add the custom specified patterns to remove to the default commands
      const customPatterns = options.slimPatterns.map(pattern => {
        return getRemovalCommand(folderPath, pattern);
      });
      stripCmd = stripCmd.concat(customPatterns);
    }
  }
  return stripCmd;
}

/**
 * Gets the commands to slim the default (safe) files:
 * including removing caches, stripping compiled files, removing dist-infos
 * @param {String} folderPath
 * @return {Array}
 */
function getDefaultSLimOptions(folderPath) {
  return [
    `&& find ${folderPath} -name "*.so" -exec strip {} \\;`,
    `&& find ${folderPath} -name "*.py[c|o]" -exec rm -rf {} +`,
    `&& find ${folderPath} -type d -name "__pycache__*" -exec rm -rf {} +`,
    `&& find ${folderPath} -type d -name "*.dist-info*" -exec rm -rf {} +`
  ];
}

/**
 * Get the command created fromt he find and remove template:
 * returns a string in form `&& find <folder> -name "<match>" -exec rm -rf {} +`
 * @param {String} folderPath
 * @param {String} removalMatch
 * @return {String}
 */
function getRemovalCommand(folderPath, removalMatch) {
  return `&& find ${folderPath} -type d -name "${removalMatch}" -exec rm -rf {} +`;
}

module.exports = {
  getSlimPackageCommands,
  getDefaultSLimOptions
};
