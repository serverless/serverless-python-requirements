const fse = require('fs-extra');
const path = require('path');
const get = require('lodash.get');
const set = require('lodash.set');
const values = require('lodash.values');
const rimraf = require('rimraf');

/**
 * Make a symlink
 * @param {string} source
 * @param {string} target
 * @return {undefined}
 */
function makeSymlink(source, target) {
  try {
   fse.symlinkSync(source, target);
  } catch (exception) {
    if (exception.code === 'EPERM' && process.platform !== 'win32') {
      fse.copySync(source, target);
    } else {
      let linkDest = null;
      try {
        linkDest = fse.readlinkSync(target);
      } catch (e) {
      }
      if (linkDest !== source) {
        throw exception;
      }
    }
  }
}

/**
 * Link requirements installed in sourceFolder to targetFolder
 * @param {string} sourceFolder
 * @param {string} targetFolder
 * @param {boolean} isPython
 * @param {Object} package
 * @param {Object} serverless
 * @param {string} servicePath
 * @param {Object} options
 * @return {undefined}
 */
function linkRequirements(sourceFolder, targetFolder, isPython, package, serverless, servicePath, options) {
  const requirementsDir = path.join(servicePath, sourceFolder);
  if (fse.existsSync('__pycache__')) {
    rimraf.sync('__pycache__');
  }
  if (!options.zip && fse.existsSync(requirementsDir)) {
    serverless.cli.log(`Linking required Python packages to ${targetFolder}...`);
    const noDeploy = new Set(options.noDeploy || []);
    fse.readdirSync(requirementsDir).map((file) => {
      if (noDeploy.has(file)) {
        return;
      }

      // don't include python deps in non-python functions
      if (isPython) {
        if (!package.exclude.includes(file)) {
          package.include.push(file);
          package.include.push(`${file}/**`);
          makeSymlink(`${requirementsDir}/${file}`, `${targetFolder}/${file}`);
        } else {
          package.exclude.push(`${file}/**`);
        }
      }
    });
  }
}

function linkAllRequirements() {
  if (this.serverless.service.package.individually) {
   values(this.serverless.service.functions)
     .forEach((f) => {
       // Initialize include and exclude arrays
       if (!get(f.package, 'include')) {
         set(f.package, ['include'], []);
       }
       if (!get(f.package, 'exclude')) {
         set(f.package, ['exclude'], []);
       }
       // Exclude everything...
       f.package.exclude.push('**');
       // ...except for the module
       f.package.include.push(f.module);
       f.package.include.push(`${f.module}/**`);
       // Update the include and exclude arrays and build symlinks
       linkRequirements(
         `.serverless/${f.name}/requirements`,
         `${f.module}`,
         (f.runtime || this.serverless.service.provider.runtime).match(/^python.*/),
         f.package,
         this.serverless,
         this.servicePath,
         this.options
       );
     });
  } else {
    // Initialize include and exclude arrays
    if (!get(this.serverless.service.package, 'include')) {
      set(this.serverless.service.package, ['include'], []);
    }
    if (!get(this.serverless.service.package, 'exclude')) {
      set(this.serverless.service.package, ['exclude'], []);
    }
    // Update the include and exclude arrays and build symlinks
    linkRequirements(
      '.serverless/requirements',
      './',
      this.serverless.service.provider.runtime.match(/^python.*/),
      this.serverless.service.package,
      this.serverless,
      this.servicePath,
      this.options
    );
  }
}


/**
 * unlink all the files in .serverless/requirements from the service directory root
 * @return {undefined}
 */
function unlinkRequirements() {
  const requirementsDir = path.join(this.servicePath, '.serverless/requirements');
  if (!this.options.zip && fse.existsSync(requirementsDir)) {
    this.serverless.cli.log('Unlinking required Python packages...');
    const noDeploy = new Set(this.options.noDeploy || []);
    fse.readdirSync(requirementsDir).map((file) => {
      if (noDeploy.has(file)) {
        return;
      }
      fse.unlinkSync(file);
    });
  }
}

module.exports = {linkAllRequirements, unlinkRequirements};
