const fse = require('fs-extra');
const path = require('path');
const get = require('lodash.get');
const set = require('lodash.set');
const values = require('lodash.values');
const rimraf = require('rimraf');


/**
 * link all the files in .serverless/requirements to the service directory root
 * @return {undefined}
 */
function linkRequirements() {
  const requirementsDir = path.join(this.servicePath, '.serverless/requirements');
  if (fse.existsSync('__pycache__')) {
    rimraf.sync('__pycache__');
  }
  if (!get(this.serverless.service, 'package.include')) {
    set(this.serverless.service, ['package', 'include'], []);
  }
  if (!this.options.zip && fse.existsSync(requirementsDir)) {
    this.serverless.cli.log('Linking required Python packages...');
    const noDeploy = new Set(this.options.noDeploy || []);
    fse.readdirSync(requirementsDir).map((file) => {
      if (noDeploy.has(file.split(/\.(py|pyc|dist-info\/?)$/)[0])) {
        return;
      }
      if (this.serverless.service.package.individually) {
        // don't include python deps in non-python functions
        values(this.serverless.service.functions)
          .filter((f) => (f.runtime || this.serverless.service.provider.runtime).match(/^python.*/))
          .forEach((f) => {
            if (!get(f, 'package.include')) {
              set(f, ['package', 'include'], []);
            }
            f.package.include.push(file);
            f.package.include.push(`${file}/**`);
          });
      } else {
        this.serverless.service.package.include.push(file);
        this.serverless.service.package.include.push(`${file}/**`);
      }
      try {
        fse.symlinkSync(`${requirementsDir}/${file}`, `./${file}`);
      } catch (exception) {
        if (exception.code === 'EPERM' && process.platform === 'win32') {
          fse.copySync(`${requirementsDir}/${file}`, `./${file}`);
        } else {
          let linkDest = null;
          try {
            linkDest = fse.readlinkSync(`./${file}`);
          } catch (e) {
          }
          if (linkDest !== `${requirementsDir}/${file}`) {
            throw exception;
          }
        }
      }
    });
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
      if (noDeploy.has(file.split(/\.(py|pyc|dist-info\/?)$/)[0])) {
        return;
      }
      fse.unlinkSync(file);
    });
  }
}

module.exports = {linkRequirements, unlinkRequirements};
