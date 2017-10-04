const BbPromise = require('bluebird');
const fse = require('fs-extra');

BbPromise.promisifyAll(fse);

/**
  * link all the files in .requirements to the service directory root
  * @return {undefined}
  */
function linkRequirements() {
  if (!this.options.zip && fse.existsSync('.requirements')) {
    this.serverless.cli.log('Linking required Python packages...');
    const noDeploy = new Set(this.options.noDeploy || []);
    fse.readdirSync('.requirements').map((file) => {
      if (noDeploy.has(file))
        return;
      this.serverless.service.package.include.push(file);
      this.serverless.service.package.include.push(`${file}/**`);
      try {
        fse.symlinkSync(`.requirements/${file}`, `./${file}`);
      } catch (exception) {
        let linkDest = null;
        try {
          linkDest = fse.readlinkSync(`./${file}`);
        } catch (e) {
          if (linkDest !== `.requirements/${file}`) {
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
  * unlink all the files in .requirements from the service directory root
  * @return {undefined}
  */
function unlinkRequirements() {
  if (!this.options.zip && fse.existsSync('.requirements')) {
    this.serverless.cli.log('Unlinking required Python packages...');
    const noDeploy = new Set(this.options.noDeploy || []);
    fse.readdirSync('.requirements').map((file) => {
      if (noDeploy.has(file))
        return;
      fse.unlinkSync(file);
    });
  }
}

module.exports = {linkRequirements, unlinkRequirements};
