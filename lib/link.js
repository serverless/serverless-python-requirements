const fse = require('fs-extra');
const path = require('path');
const _ = require('lodash');

/**
 * link all the files in .serverless/requirements to the service directory root
 * @return {undefined}
 */
function linkRequirements() {
  const requirementsDir = path.join(this.servicePath, '.serverless/requirements');
  if (!_.get(this.serverless.service, 'package.include'))
    _.set(this.serverless.service, ['package', 'include'], []);
  if (!this.options.zip && fse.existsSync(requirementsDir)) {
    this.serverless.cli.log('Linking required Python packages...');
    const noDeploy = new Set(this.options.noDeploy || []);
    fse.readdirSync(requirementsDir).map((file) => {
      if (noDeploy.has(file))
        return;
      if (this.serverless.service.package.individually) {
        // don't include python deps in non-python functions
        _.each(
          _.filter(
            this.serverless.service.functions,
            (f) => { return (f.runtime || this.serverless.service.provider.runtime).match(/^python.*/) }
          ),
          (f) => {
            if (!_.get(f, 'package.include'))
              _.set(f, ['package', 'include'], []);
            f.package.include.push(file)
            f.package.include.push(`${file}/**`)
          }
        );
      } else {
        this.serverless.service.package.include.push(file);
        this.serverless.service.package.include.push(`${file}/**`);
      }
      try {
        fse.symlinkSync(`${requirementsDir}/${file}`, `./${file}`);
      } catch (exception) {
        let linkDest = null;
        try {
          linkDest = fse.readlinkSync(`./${file}`);
        } catch (e) {
          if (linkDest !== `${requirementsDir}/${file}`) {
            const errorMessage = `Unable to link dependency '${file}' ` +
              'because a file by the same name exists in this service';
            throw new Error(errorMessage);
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
      if (noDeploy.has(file))
        return;
      fse.unlinkSync(file);
    });
  }
}

module.exports = {linkRequirements, unlinkRequirements};
