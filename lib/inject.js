const fse = require('fs-extra');
const glob = require('glob-all');
const get = require('lodash.get');
const set = require('lodash.set');
const path = require('path');
const values = require('lodash.values');
const zipper = require('zip-local');
const JSZip = require('jszip');

/**
 * write zip contents to a file
 * @param {Object} zip
 * @param {string} path
 */
function writeZip(zip, path) {
  const buff = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  fse.writeFileSync(path, buff);
}

/**
 * add a new file to a zip file from a buffer
 * @param {Object} zip
 * @param {string} path path to put in zip
 * @param {string} buffer file contents
 */
function zipFile(zip, path, buffer) {
  zip.file(path, buffer, {
    date: new Date(0), // necessary to get the same hash when zipping the same content
  });
}

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

    if (relativeFile.match(/^__pycache__[\\\/]/)) {
      return;
    }
    if (noDeploy.has(relativeFile.split(/([-\\\/]|\.py$|\.pyc$)/, 1)[0])) {
      return;
    }

    zipFile(zip, relativeFile, fse.readFileSync(file));
  });

  writeZip(zip, packagePath);
}

/**
 * remove all modules but the selected module from a package
 * @param {string} source original package
 * @param {string} target result package
 * @param {string} module module to keep
 */
function moveModuleUp(source, target, module) {
  const sourceZip = zipper.sync.unzip(source).memory();
  const targetZip = JSZip.make();

  sourceZip.contents().forEach((file) => {
    if (!file.startsWith(module + '/')) {
      return;
    }
    zipFile(targetZip, file.replace(module + '/', ''), sourceZip.read(file, 'buffer'));
  });

  writeZip(targetZip, target);
}

/**
 * inject requirements into packaged application
 */
function injectAllRequirements() {
  this.serverless.cli.log('Injecting required Python packages to package...');

  if (this.options.zip) {
    return;
  }

  if (this.serverless.service.package.individually) {
    values(this.serverless.service.functions)
      .forEach((f) => {
        if (!(f.runtime || this.serverless.service.provider.runtime).match(/^python.*/)) {
          return;
        }
        if (!get(f, 'module')) {
          set(f, ['module'], '.');
        }
        if (f.module !== '.') {
          const artifactPath = path.join('.serverless', `${f.module}.zip`);
          moveModuleUp(f.package.artifact, artifactPath, f.module);
          f.package.artifact = artifactPath;
        }
        injectRequirements(
          path.join('.serverless', f.module, 'requirements'),
          f.package.artifact,
          this.options
        );
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
