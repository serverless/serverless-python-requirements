const BbPromise = require('bluebird');
const fse = require('fs-extra');
const glob = require('glob-all');
const get = require('lodash.get');
const set = require('set-value');
const path = require('path');
const JSZip = require('jszip');
const { writeZip, zipFile } = require('./zipTree');

BbPromise.promisifyAll(fse);

/**
 * Inject requirements into packaged application.
 * @param {string} requirementsPath requirements folder path
 * @param {string} packagePath target package path
 * @param {Object} options our options object
 * @return {Promise} the JSZip object constructed.
 */
function injectRequirements(requirementsPath, packagePath, options) {
  const noDeploy = new Set(options.noDeploy || []);

  return fse
    .readFileAsync(packagePath)
    .then((buffer) => JSZip.loadAsync(buffer))
    .then((zip) =>
      BbPromise.resolve(
        glob.sync([path.join(requirementsPath, '**')], {
          mark: true,
          dot: true,
        })
      )
        .map((file) => [file, path.relative(requirementsPath, file)])
        .filter(
          ([file, relativeFile]) =>
            !file.endsWith('/') &&
            !relativeFile.match(/^__pycache__[\\/]/) &&
            !noDeploy.has(relativeFile.split(/([-\\/]|\.py$|\.pyc$)/, 1)[0])
        )
        .map(([file, relativeFile]) =>
          Promise.all([file, relativeFile, fse.statAsync(file)])
        )
        .mapSeries(([file, relativeFile, fileStat]) =>
          zipFile(zip, relativeFile, fse.readFileAsync(file), {
            unixPermissions: fileStat.mode,
            createFolders: false,
          })
        )
        .then(() => writeZip(zip, packagePath))
    );
}

/**
 * Remove all modules but the selected module from a package.
 * @param {string} source path to original package
 * @param {string} target path to result package
 * @param {string} module module to keep
 * @return {Promise} the JSZip object written out.
 */
function moveModuleUp(source, target, module) {
  const targetZip = new JSZip();

  return fse
    .readFileAsync(source)
    .then((buffer) => JSZip.loadAsync(buffer))
    .then((sourceZip) =>
      sourceZip.filter(
        (file) =>
          file.startsWith(module + '/') ||
          file.startsWith('serverless_sdk/') ||
          file.match(/^s_.*\.py/) !== null
      )
    )
    .map((srcZipObj) =>
      zipFile(
        targetZip,
        srcZipObj.name.startsWith(module + '/')
          ? srcZipObj.name.replace(module + '/', '')
          : srcZipObj.name,
        srcZipObj.async('nodebuffer')
      )
    )
    .then(() => writeZip(targetZip, target));
}

/**
 * Inject requirements into packaged application.
 * @return {Promise} the combined promise for requirements injection.
 */
async function injectAllRequirements(funcArtifact) {
  if (this.options.layer) {
    // The requirements will be placed in a Layer, so just resolve
    return BbPromise.resolve();
  }

  let injectProgress;
  if (this.progress && this.log) {
    injectProgress = this.progress.get('python-inject-requirements');
    injectProgress.update('Injecting required Python packages to package');
    this.log.info('Injecting required Python packages to package');
  } else {
    this.serverless.cli.log('Injecting required Python packages to package...');
  }

  try {
    if (this.serverless.service.package.individually) {
      await BbPromise.resolve(this.targetFuncs)
        .filter((func) =>
          (func.runtime || this.serverless.service.provider.runtime).match(
            /^python.*/
          )
        )
        .map((func) => {
          if (!get(func, 'module')) {
            set(func, ['module'], '.');
          }
          return func;
        })
        .map((func) => {
          if (func.module !== '.') {
            const artifact = func.package
              ? func.package.artifact
              : funcArtifact;
            const newArtifact = path.join(
              '.serverless',
              `${func.module}-${func.name}.zip`
            );
            func.package.artifact = newArtifact;
            return moveModuleUp(artifact, newArtifact, func.module).then(
              () => func
            );
          } else {
            return func;
          }
        })
        .map((func) => {
          return this.options.zip
            ? func
            : injectRequirements(
                path.join('.serverless', func.module, 'requirements'),
                func.package.artifact,
                this.options
              );
        });
    } else if (!this.options.zip) {
      await injectRequirements(
        path.join('.serverless', 'requirements'),
        this.serverless.service.package.artifact || funcArtifact,
        this.options
      );
    }
  } finally {
    injectProgress && injectProgress.remove();
  }
}

module.exports = { injectAllRequirements };
