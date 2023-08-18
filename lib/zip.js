import { rm, cp } from 'fs/promises';
import { resolve, join, dirname } from 'path';
import uniqBy from 'lodash.uniqby';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Add the vendor helper to the current service tree.
 * @return {Promise}
 */
async function addVendorHelper() {
  if (this.options.zip) {
    if (this.serverless.service.package.individually) {
      const moduleFuncs = uniqBy(
        await this.targetFuncs.map((f) => {
          if (!f?.package?.patterns) {
            f = Object.assign(f, {
              package: {
                patterns: [],
              },
            });
          }
          if (!f?.module) {
            f.module = '.';
          }
          f.package.patterns.push('unzip_requirements.py');
          return f;
        }),
        (f) => f.module
      );
      await Promise.all(
        moduleFuncs.map(async (f) => {
          this.log.info(`Adding Python requirements helper to ${f.module}`);
          await cp(
            resolve(__dirname, '../unzip_requirements.py'),
            join(this.serviceDir, f.module, 'unzip_requirements.py')
          );
        })
      );
    } else {
      this.log.info('Adding Python requirements helper');
      if (!this.serverless.service?.package?.patterns) {
        this.serverless.service = Object.assign(this.serverless.service, {
          package: {
            patterns: [],
          },
        });
      }

      this.serverless.service.package.patterns.push('unzip_requirements.py');

      await cp(
        resolve(__dirname, '../unzip_requirements.py'),
        join(this.serviceDir, 'unzip_requirements.py')
      );
    }
  }
}

/**
 * Remove the vendor helper from the current service tree.
 * @return {Promise} the promise to remove the vendor helper.
 */
async function removeVendorHelper() {
  if (this.options.zip && this.options.cleanupZipHelper) {
    if (this.serverless.service.package.individually) {
      const moduleFuncs = uniqBy(
        this.targetFuncs.map((f) => {
          if (!f?.module) {
            f.module = '.';
          }
          return f;
        }),
        (f) => f.module
      );
      await Promise.all(
        moduleFuncs.map(async (f) => {
          this.log.info(`Removing Python requirements helper from ${f.module}`);
          await rm(join(this.serviceDir, f.module, 'unzip_requirements.py'), {
            force: true,
            recursive: true,
          });
        })
      );
    } else {
      this.log.info('Removing Python requirements helper');
      await rm(join(this.serviceDir, 'unzip_requirements.py'), {
        force: true,
        recursive: true,
      });
    }
  }
}

/**
 * Zip up .serverless/requirements or .serverless/[MODULE]/requirements.
 * @return {Promise} the promise to pack requirements.
 */
async function packRequirements() {
  if (this.options.zip) {
    if (this.serverless.service.package.individually) {
      let moduleFuncs = uniqBy(
        this.targetFuncs.map((f) => {
          if (!f?.module) {
            f.module = '.';
          }
          return f;
        }),
        (f) => f.module
      );
      await Promise.all(
        moduleFuncs.map(async (f) => {
          let packProgress = this.progress.get(
            `python-pack-requirements-${f.module}`
          );
          packProgress.update(
            `Zipping required Python packages for ${f.module}`
          );
          this.log.info(`Zipping required Python packages for ${f.module}`);
          f.package.patterns.push(`${f.module}/.requirements.zip`);
          const zip = new AdmZip();
          await zip.addLocalFolderPromise(
            `.serverless/${f.module}/requirements`
          );
          await zip.writeZipPromise(`${f.module}/.requirements.zip`);
          packProgress.remove();
        })
      );
    } else {
      let packProgress = this.progress.get(`python-pack-requirements`);
      this.serverless.service.package.patterns.push('.requirements.zip');
      const zip = new AdmZip();
      await zip.addLocalFolderPromise(`.serverless/requirements`);
      await zip.writeZipPromise(join(this.serviceDir, '.requirements.zip'));
      packProgress.remove();
    }
  }
}

export { addVendorHelper, removeVendorHelper, packRequirements };
