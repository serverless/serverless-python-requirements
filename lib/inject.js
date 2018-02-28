const fse = require('fs-extra');
const glob = require('glob-all');
const get = require('lodash.get');
const set = require('lodash.set');
const path = require('path');
const values = require('lodash.values');
const zipper = require('zip-local');

/**
 * inject requirements into packaged application
 * @param {string} requirementsPath requirements folder path
 * @param {string} packagePath target package path
 * @param {Object} options our options object
 */
function injectRequirements(requirementsPath, packagePath, options) {
  const noDeploy = new Set(options.noDeploy || []);

  const zip = zipper.sync.unzip(packagePath).lowLevel();

  glob.sync([path.join(requirementsPath, '**')], {mark: true, dot: true}).forEach((file) => {
    if (file.endsWith('/')) {
      return;
    }

    const relativeFile = path.relative(requirementsPath, file);

    if (noDeploy.has(relativeFile.split(/[-\\\/]/, 1)[0])) {
      return;
    }

    zip.file(relativeFile, fse.readFileSync(file), {
      date: new Date(0), // necessary to get the same hash when zipping the same content
    });
  });

  const buff = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  fse.writeFileSync(packagePath, buff);
}

/**
 * inject requirements into packaged application
 */
function injectAllRequirements() {
  this.serverless.cli.log('Injecting required Python packages to package...');

  if (this.serverless.service.package.individually) {
    let doneModules = [];
    values(this.serverless.service.functions)
      .forEach((f) => {
        if (!get(f, 'module')) {
          set(f, ['module'], '.');
        }
        if (!doneModules.includes(f.module)) {
          injectRequirements(
            path.join('.serverless', f.module, 'requirements'),
            f.package.artifact,
            this.options
          );
          doneModules.push(f.module);
        }
      });
  } else {
    injectRequirements(
      path.join('.serverless', 'requirements'),
      this.serverless.service.package.artifact,
      this.options
    );
  }
}

module.exports = {injectAllRequirements};
