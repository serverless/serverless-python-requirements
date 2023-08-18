import fg from 'fast-glob';
import { join, resolve } from 'path';
import { readFile, stat, rm } from 'fs/promises';
import { createHash } from 'crypto';

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * This helper will check if we're using static cache and have max
 * versions enabled and will delete older versions in a fifo fashion
 * @param  {Object} options
 * @param  {Object} serverless
 * @return {undefined}
 */
async function checkForAndDeleteMaxCacheVersions({ options, log }) {
  // If we're using the static cache, and we have static cache max versions enabled
  if (
    options.useStaticCache &&
    options.staticCacheMaxVersions &&
    parseInt(options.staticCacheMaxVersions) > 0
  ) {
    // Get the list of our cache files
    const files = await fg.glob(
      [join(getUserCachePath(options), '*_slspyc/')],
      {
        markDirectories: true,
        dot: true,
      }
    );
    // Check if we have too many
    if (files.length >= options.staticCacheMaxVersions) {
      // Sort by modified time
      await Promise.all(
        files.sort(async (a, b) => {
          return (
            (await stat(a)).mtime.getTime() - (await stat(b)).mtime.getTime()
          );
        })
      );
      // Remove the older files...
      var items = 0;
      for (
        var i = 0;
        i < files.length - options.staticCacheMaxVersions + 1;
        i++
      ) {
        await rm(files[i]);
        items++;
      }

      // Log the number of cache files flushed
      log.info(
        `Removed ${items} items from cache because of staticCacheMaxVersions`
      );
    }
  }
}

/**
 * The working path that all requirements will be compiled into
 * @param  {string} subfolder
 * @param  {string} serviceDir
 * @param  {Object} options
 * @param  {Object} serverless
 * @return {string}
 */
function getRequirementsWorkingPath(
  subfolder,
  requirementsTxtDirectory,
  options,
  serverless
) {
  // If we want to use the static cache
  if (options && options.useStaticCache) {
    if (subfolder) {
      const architecture = serverless.service.provider.architecture || 'x86_64';
      subfolder = `${subfolder}_${architecture}_slspyc`;
    }
    // If we have max number of cache items...

    return join(getUserCachePath(options), subfolder);
  }

  // If we don't want to use the static cache, then fallback to the way things used to work
  return join(requirementsTxtDirectory, 'requirements');
}

/**
 * Path of a cached requirements layer archive file
 * @param  {string} subfolder
 * @param  {string} fallback
 * @param  {Object} options
 * @param  {Object} serverless
 * @return {string}
 */
function getRequirementsLayerPath(hash, fallback, options, serverless) {
  // If we want to use the static cache
  if (hash && options && options.useStaticCache) {
    const architecture = serverless.service.provider.architecture || 'x86_64';
    hash = `${hash}_${architecture}_slspyc.zip`;
    return join(getUserCachePath(options), hash);
  }

  // If we don't want to use the static cache, then fallback to requirements file in .serverless directory
  return fallback;
}

/**
 * The static cache path that will be used for this system + options, used if static cache is enabled
 * @param  {Object} options
 * @return {string}
 */
function getUserCachePath(options) {
  // If we've manually set the static cache location
  if (options && options.cacheLocation) {
    return resolve(options.cacheLocation);
  }

  const appName = 'serverless-python-requirements';

  let dataPath;
  if (process.platform === 'win32') {
    dataPath = join(
      process.env.LOCALAPPDATA || process.env.APPDATA,
      appName,
      'Cache'
    );
  } else if (process.platform === 'darwin') {
    dataPath = join(process.env.HOME, 'Library', 'Caches', appName);
  } else {
    if (process.env.XDG_CACHE_HOME) {
      dataPath = join(process.env.XDG_CACHE_HOME, appName);
    } else {
      dataPath = join(process.env.HOME, '.cache', appName);
    }
  }
  return dataPath;
}

/**
 * Helper to get the md5 a a file's contents to determine if a requirements has a static cache
 * @param  {string} fullpath
 * @return {string}
 */
async function sha256Path(fullpath) {
  const buf = await readFile(fullpath);
  return createHash('sha256').update(buf).digest('hex');
}

export {
  checkForAndDeleteMaxCacheVersions,
  getRequirementsWorkingPath,
  getRequirementsLayerPath,
  getUserCachePath,
  sha256Path,
  exists,
};
