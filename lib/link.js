const fse = require('fs-extra');
const path = require('path');
const rimraf = require('rimraf');
const zipper = require('zip-local');
const {get, set, values} = require('lodash');

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
function linkRequirements(
  sourceFolder, targetFolder, isPython, package, serverless, servicePath, options
) {
  const requirementsDir = path.join(servicePath, sourceFolder);
  if (fse.existsSync('__pycache__')) {
    rimraf.sync('__pycache__');
  }
  if (!options.zip && fse.existsSync(requirementsDir)) {
    serverless.cli.log(`Linking required Python packages to ${targetFolder}...`);
    const noDeploy = new Set(options.noDeploy || []);
    fse.readdirSync(requirementsDir).map((file) => {
      if (noDeploy.has(file.split(/\.(py|pyc|dist-info\/?)$/)[0])) {
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

/**
 * Link all requirements files
 * @return {undefined}
 */
function linkAllRequirements() {
  if (this.serverless.service.package.individually) {
    values(this.serverless.service.functions)
      .forEach((f) => {
        // Initialize include and exclude arrays
        if (!get(f, 'package.include')) {
          set(f, ['package', 'include'], []);
        }
        if (!get(f, 'package.exclude')) {
          set(f, ['package', 'exclude'], []);
        }
        if (!get(f, 'module')) {
          set(f, ['module'], '.');
        }
        // Update the include and exclude arrays and build symlinks
        linkRequirements(
          path.join('.serverless', f.module, 'requirements'),
          f.module,
          (f.runtime || this.serverless.service.provider.runtime).match(/^python.*/),
          f.package,
          this.serverless,
          this.servicePath,
          this.options
        );
        if (f.module !== '.') {
          const artifactPath = `.serverless/${f.module}.zip`;
          f.package.artifact = artifactPath;
          zipper.sync.zip(f.module).compress().save(artifactPath);
        }
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
 * Unlink requirements installed from targetFolder
 * @param {string} sourceFolder
 * @param {string} targetFolder
 * @param {Object} serverless
 * @param {string} servicePath
 * @param {Object} options
 * @return {undefined}
 */
function unlinkRequirements(sourceFolder, targetFolder, serverless, servicePath, options) {
  const requirementsDir = path.join(servicePath, sourceFolder);
  if (!options.zip && fse.existsSync(requirementsDir)) {
    serverless.cli.log(`Unlinking required Python packages from ${targetFolder}...`);
    const noDeploy = new Set(options.noDeploy || []);
    fse.readdirSync(requirementsDir).map((file) => {
      if (noDeploy.has(file.split(/\.(py|pyc|dist-info\/?)$/)[0])) {
        return;
      }
      let targetFile = path.join(targetFolder, file);
      if (fse.existsSync(targetFile)) {
        fse.unlinkSync(targetFile);
      }
    });
  }
}


/**
 * Unlink all the requirements files
 * @return {undefined}
 */
function unlinkAllRequirements() {
  if (this.serverless.service.package.individually) {
    let doneModules = [];
    values(this.serverless.service.functions)
      .forEach((f) => {
        if (!doneModules.includes(f.module)) {
          unlinkRequirements(
            `.serverless/${f.module}/requirements`,
            `${f.module}`,
            this.serverless,
            this.servicePath,
            this.options
          );
          doneModules.push(f.module);
        }
      });
  } else {
    unlinkRequirements(
      '.serverless/requirements',
      './',
      this.serverless,
      this.servicePath,
      this.options
    );
  }
}

module.exports = {linkAllRequirements, unlinkAllRequirements};
