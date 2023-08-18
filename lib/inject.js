import { join } from 'path';
import AdmZip from 'adm-zip';
import { mkdir } from 'fs/promises';

/**
 * Inject requirements into packaged application.
 * @param {string} requirementsPath requirements folder path
 * @param {string} packagePath target package path
 * @param {Object} options our options object
 * @return {Promise} the AdmZip object constructed.
 */
async function injectRequirements(requirementsPath, packagePath, options) {
  await mkdir(requirementsPath, { recursive: true });
  const noDeploy = new Set(options.noDeploy || []);
  const zip = new AdmZip(packagePath);
  await zip.addLocalFolderPromise(requirementsPath, {
    filter: (filename) =>
      !filename.match(/^__pycache__[\\/]/) &&
      !noDeploy.has(filename.split(/([-\\/]|\.py$|\.pyc$)/, 1)[0]),
  });
  await zip.writeZipPromise();
  return packagePath;
}

/**
 * Remove all modules but the selected module from a package.
 * @param {string} source path to original package
 * @param {string} target path to result package
 * @param {string} module module to keep
 * @return {Promise} the AdmZip object written out.
 */
async function moveModuleUp(source, target, module) {
  var sourceZip = new AdmZip(source);
  var targetZip = new AdmZip();
  sourceZip.getEntries().forEach(function (zipEntry) {
    if (
      zipEntry.entryName.startsWith(module + '/') ||
      zipEntry.entryName.startsWith('serverless_sdk') ||
      zipEntry.entryName.match(/^s_.*\.py/) !== null
    ) {
      targetZip.addFile(
        zipEntry.entryName.startsWith(module + '/')
          ? zipEntry.entryName.replace(module + '/', '')
          : zipEntry.entryName
      );
    }
  });
  await targetZip.writeZipPromise(target);
}

/**
 * Inject requirements into packaged application.
 * @return {Promise} the combined promise for requirements injection.
 */
async function injectAllRequirements(funcArtifact) {
  if (this.options.layer) {
    // The requirements will be placed in a Layer, so just resolve
    return;
  }

  let injectProgress = this.progress.get('python-inject-requirements');
  injectProgress.update('Injecting required Python packages to package');
  this.log.info('Injecting required Python packages to package');

  try {
    if (this.serverless.service.package.individually) {
      await Promise.all(
        this.targetFuncs
          .filter((func) =>
            (func.runtime || this.serverless.service.provider.runtime).match(
              /^python.*/
            )
          )
          .map(async (func) => {
            if (!func?.module) {
              func.module = '.';
            }
            if (func.module !== '.') {
              const artifact = func.package
                ? func.package.artifact
                : funcArtifact;
              const newArtifact = join(
                '.serverless',
                `${func.module}-${func.name}.zip`
              );
              func.package.artifact = newArtifact;
              await moveModuleUp(artifact, newArtifact, func.module);
            }
            return this.options.zip
              ? func
              : await injectRequirements(
                  join('.serverless', func.module, 'requirements'),
                  func.package.artifact,
                  this.options
                );
          })
      );
    } else if (!this.options.zip) {
      await injectRequirements(
        join('.serverless', 'requirements'),
        this.serverless.service.package.artifact || funcArtifact,
        this.options
      );
    }
  } finally {
    injectProgress.remove();
  }
}

export { injectAllRequirements };
