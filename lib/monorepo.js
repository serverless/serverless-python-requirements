const path = require('path')
const fsExtra = require('fs-extra')
const fs = require('fs')
const {
    dockerPathForWin, getRequirementsWorkingPath
} = require('./shared')
const {
    v4
} = require('uuid')
const TOML = require('@iarna/toml')
const { exec } = require('child_process')

/**
 * Method for using Docker to build dependencies using poetry. Requires that a Custom Docker image with the target 
 * Python version + Poetry specified (and part of $PATH). Also requires that in-project virtual environments are configured
 * (see https://python-poetry.org/docs/configuration/#virtualenvsin-project).
 * 
 * Performs the following operations:
 * - Cleans the Docker bindpath of any other files
 * - Copies the monorepo directory (1 directory above the Serverless API directory) to the bind path
 * - Cleans out all .venv directories
 * - Runs an install operation in the API dir
 */
function buildDockerPoetryMonorepo() {
    if (!this.options.dockerBuildPoetryMonorepo) {
        return
    }

    // Come up with a temp bind path that we can use to share with the Docker instance
    const serverlessMonorepoPath = path.dirname(this.serverless.config.servicePath)
    const bindPath = dockerPathForWin(getRequirementsWorkingPath(v4(), path.join(path.dirname(serverlessMonorepoPath, 'temp')), {useStaticCache: true}))
    const serverlessRequirementsZipPath = path.join(this.serverless.config.servicePath, '.serverless', 'requirements')
    fsExtra.mkdirSync(bindPath)

    // Create a requirements directory within .serverless for zipping
    fsExtra.ensureDirSync(serverlessRequirementsZipPath)
    fsExtra.emptyDirSync(serverlessRequirementsZipPath)

    this.serverless.cli.log(`Created temp Docker bind path ${bindPath}`);

    const bindPathApiDir = path.join(bindPath, path.basename(this.serverless.config.servicePath))
    const apiDirName = path.basename(this.serverless.config.servicePath)
    const tomlFilePath = path.join(bindPathApiDir, 'pyproject.toml')

    // Clean up the bind path directory so that we can start fresh
    fsExtra.emptyDirSync(bindPath)

    this.serverless.cli.log(`Copying monorepo from ${serverlessMonorepoPath} to ${bindPath}`);
    this.serverless.cli.log(`Excluding node_modules, .venv, poetry.lock, .git`);

    // Copy the contents of the Serverless Monorepo to the bindpath so that
    // Docker has something to work with
    return new Promise((resolve, reject) => {
        exec(`rsync -rav --progress ${serverlessMonorepoPath}/ ${bindPath} --exclude node_modules --exclude .venv --exclude poetry.lock --exclude .git`, (err, stdout, stderr) => {
            if (err) {
                this.serverless.cli.log(`Error copying files from ${serverlessMonorepoPath} to ${bindPath}: ${stderr}`);
                reject()
            } else {
                resolve()
            }
        })
    }).then(() => {
        this.serverless.cli.log(`Updating toml file to remove develop attributes on linked libs`);
        removeTomlEditableDependencies(tomlFilePath)
    
        this.serverless.cli.log(`Running docker commands...`);

        /* Runs something like the following:
         * docker run --rm -v /Users/timgrowney/Library/Caches/serverless-python-requirements/cae0c72f-48b1-4171-8ebd-904541244b56_slspyc\:/var/task\:z -w /var/task/api-runamo tgrowneyhydra/python-builder\:latest poetry install
         * Breaking this down, it mounts the temp cache dir on the host side to /var/task, sets the working directory to /var/task/api-runamo, then runs the command `poetry install` on the `tgrowneyhydra/python-builder\:latest` image
        */
        return new Promise((resolve, reject) => {
            const dockerCmd = `docker run --rm -v ${bindPath}:/var/task:z -w /var/task/${apiDirName} ${this.options.dockerImage} poetry install --no-dev`
            this.serverless.cli.log(`Running ${dockerCmd}`);

            exec(`${dockerCmd}`, (err, stdout, stderr) => {
                if (err) {
                    this.serverless.cli.log(`Error running docker script: ${stderr}`);
                    reject()
                } else {
                    this.serverless.cli.log(`${stdout}`);
                    resolve()
                }
            })         
        })
    }).then(() => {
        // Copy packages from the mounted build directory to the .serverless/requirements directory
        const copySourcePath = `${bindPath}/api-runamo/.venv/lib/python3.9/site-packages/`
              
        this.serverless.cli.log(`Copying dependencies from ${copySourcePath} to ${serverlessRequirementsZipPath}`);
        return new Promise((resolve, reject) => {
            exec(`rsync -rav --progress ${copySourcePath} ${serverlessRequirementsZipPath} --exclude pip* --exclude setuptools* --exclude wheel* --exclude *.pth --exclude *.virtualenv --exclude __pycache__ --exclude _distutils_hack --exclude pkg_resources --exclude _virtualenv.py`, (err, stdout, stderr) => {
                if (err) {
                    this.serverless.cli.log(`Error copying files from ${bindPath} to ${serverlessRequirementsZipPath}: ${stderr}`);
                    reject()
                } else {
                    resolve()
                }
            })
        })
    }).then(() => {
        // Copy the handlers to the .serverless/requirements directory to stage them for final zipping in a later step
        const handlerSourcePaths = getHandlerSourcePaths(this.serverless.service.functions)
        const directories = Object.keys(handlerSourcePaths)

        const promises = []

        directories.forEach((directory) => {
            if (directory === 'root') {
                return
            }

            const promise = new Promise((resolve, reject) => {
                const handlerDirPath = `${this.serverless.config.servicePath}/${directory}`
                exec(`rsync -rav --progress ${handlerDirPath} ${serverlessRequirementsZipPath}`, (err, stdout, stderr) => {
                    if (err) {
                        this.serverless.cli.log(`Error copying handler directories from ${handlerDirPath} to ${serverlessRequirementsZipPath}: ${stderr}`);
                        reject(stderr)
                    } else {
                        resolve()
                    }
                })
            })

            promises.push(promise)
        })

        if (handlerSourcePaths.root && handlerSourcePaths.root.length) {
            const individualHandlerFiles = handlerSourcePaths.root

            individualHandlerFiles.forEach((file) => {
                const filePath = `${this.serverless.config.servicePath}/${file}`

                const promise = new Promise((resolve, reject) => {
                    exec(`rsync -rav --progress ${filePath} ${serverlessRequirementsZipPath}`, (err, stdout, stderr) => {
                        if (err) {
                            this.serverless.cli.log(`Error copying handler files from ${handlerDirPath} to ${serverlessRequirementsZipPath}: ${stderr}`);
                            reject(stderr)
                        } else {
                            resolve()
                        }
                    })
                })

                promises.push(promise)
            })
        }

        return Promise.all(promises)
    })
}

function zipMonoRepoDeps() {
    if (!this.options.dockerBuildPoetryMonorepo) {
        return
    }

    const serverlessRequirementsZipPath = path.join(this.serverless.config.servicePath, '.serverless', 'requirements')
    const serverlessDotDirectoryPath = path.join(this.serverless.config.servicePath, '.serverless')
    const apiDirName = path.basename(this.serverless.config.servicePath)

    fsExtra.rmSync(`${serverlessDotDirectoryPath}/${apiDirName}.zip`, {force: true})

    this.serverless.cli.log(`Zipping dependencies`);

    return new Promise((resolve, reject) => {
        exec(`cd ${serverlessRequirementsZipPath}; zip -r ../${apiDirName}.zip ./*`, (err, stdout, stderr) => {
            if (err) {
                this.serverless.cli.log(`Error zipping requirements files from ${serverlessRequirementsZipPath}: ${stderr}`);
                reject(stderr)
            } else {
                resolve()
            }
        })
    })
}

function removeTomlEditableDependencies(tomlFilePath) {
    const tomlFile = tomlFilePath
    const tomlFileStringContents = fs.readFileSync(tomlFile).toString()

    const tomlFileContents = TOML.parse(tomlFileStringContents)

    //@ts-ignore
    const dependencies = tomlFileContents.tool.poetry.dependencies

    //@ts-ignore
    const dependencyKeys = Object.keys(dependencies)

    dependencyKeys.forEach((dependencyKey) => {
        const dependency = dependencies[dependencyKey]

        //@ts-ignore
        if (typeof dependency === 'object' && dependency.develop) {
            //@ts-ignore
            delete dependency.develop
        }
    })

    delete tomlFileContents['tool']['poetry']['dev-dependencies']

    fs.rmSync(tomlFilePath)
    fs.writeFileSync(tomlFilePath, TOML.stringify(tomlFileContents))
}

/**
 * Handler files could be at the root of the service path, or they could be in like a /src directory.
 * Figure out where they are and copy them appropriately.
 */
function getHandlerSourcePaths(functions) {
    const paths = {}

    const functionKeys = Object.keys(functions)

    // Serverless functions object looks like the following:
    // {"hello":{"handler":"src/handler.hello","events":[{"http":{"path":"hello","method":"get"}}],"name":"dev-hello"}}
    functionKeys.forEach((slsFuncName) => {
        const slsFunc = functions[slsFuncName]
        const isInRoot = slsFunc.handler.indexOf('/') === -1

        if (isInRoot) {
            if (!paths.root) {
                paths.root = []
            }

            const functionHandlerFile = `${slsFunc.handler.split('.')[0]}.py`
            paths.root.push(functionHandlerFile)
        } else {
            const parentPath = path.dirname(slsFunc.handler)

            if (!paths[parentPath]) {
                paths[parentPath] = true
            }
        }
    })

    return paths
}

module.exports = { buildDockerPoetryMonorepo, zipMonoRepoDeps }