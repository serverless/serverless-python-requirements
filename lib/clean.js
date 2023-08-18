import { rm } from 'fs/promises';
import { join } from 'path';
import fg from 'fast-glob';
import { exists, getUserCachePath } from './shared.js';

/**
 * clean up .requirements and .requirements.zip and unzip_requirements.py
 * @return {Promise}
 */
async function cleanup() {
  const artifacts = ['.requirements'];
  if (this.options.zip) {
    if (this.serverless.service.package.individually) {
      this.targetFuncs.forEach((f) => {
        artifacts.push(join(f.module, '.requirements.zip'));
        artifacts.push(join(f.module, 'unzip_requirements.py'));
      });
    } else {
      artifacts.push('.requirements.zip');
      artifacts.push('unzip_requirements.py');
    }
  }

  return await Promise.all(
    artifacts.map(
      async (artifact) =>
        await rm(join(this.serviceDir, artifact), {
          recursive: true,
          force: true,
        })
    )
  );
}

/**
 * Clean up static cache, remove all items in there
 * @return {Promise}
 */
async function cleanupCache() {
  const cacheLocation = getUserCachePath(this.options);
  if (await exists(cacheLocation)) {
    let cleanupProgress = this.progress.get('python-cleanup-cache');
    cleanupProgress.notice('Removing static caches');
    this.log.info(`Removing static caches at: ${cacheLocation}`);

    // Only remove cache folders that we added, just incase someone accidentally puts a weird
    // static cache location so we don't remove a bunch of personal stuff
    try {
      await Promise.all(
        (
          await fg.glob([join(cacheLocation, '*slspyc/')], {
            markDirectories: true,
            dot: false,
          })
        ).forEach(async (file) => {
          await rm(file, { force: true, recursive: true });
        })
      );
    } finally {
      cleanupProgress.remove();
    }
  } else {
    this.log.info(`No static cache found`);
  }
}

export { cleanup, cleanupCache };
