# Serverless Python Requirements

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![circleci](https://img.shields.io/circleci/project/github/RedSparr0w/node-csgo-parser/master.svg)](https://circleci.com/gh/UnitedIncome/serverless-python-requirements)
[![npm](https://nodei.co/npm/serverless-python-requirements.png?mini=true)](https://www.npmjs.com/package/serverless-python-requirements)

A Serverless v1.x plugin to automatically bundle dependencies from
`requirements.txt` and make them available in your `PYTHONPATH`.

**Requires Serverless >= v1.12**

## Install

```
npm install --save serverless-python-requirements
```

Add the plugin to your `serverless.yml`:

```yaml
plugins:
  - serverless-python-requirements
```


## Cross compiling!
Compiling non-pure-Python modules or fetching their manylinux wheels is
supported on non-linux OSs via the use of Docker and the
[docker-lambda](https://github.com/lambci/docker-lambda) image.
To enable docker usage, add the following to your `serverless.yml`:
```yaml
custom:
  pythonRequirements:
    dockerizePip: true
```
To utilize your own Docker container instead of the default, add the following to your `serverless.yml`:
```yaml
custom:
  pythonRequirements:
    dockerImage: <image name>:tag
```
This must be the full image name and tag to use, including the runtime specific tag if applicable.


## Dealing with Lambda's size limitations
To help deal with potentially large dependencies (for example: `numpy`, `scipy`
and `scikit-learn`) there is support for compressing the libraries. This does
require a minor change to your code to decompress them.  To enable this add the
following to your  `serverless.yml`:
```yaml
custom:
  pythonRequirements:
    zip: true
```

and add this to your handler module before any code that imports your deps:
```python
import unzip_requirements
```

If you want to be able to use `sls invoke local` and don't have a check for
lambda or a `try`/`except ImportError` around that import, you can use the
following option to make this plugin not delete the `unzip_requirements`
helper:
```yaml
custom:
  pythonRequirements:
    cleanupZipHelper: false
```

## Omitting Packages 
You can omit a package from deployment by adding `#no-deploy` to the
requirement's line in `requirements.txt`. For example, this will not install
the AWS SDKs that are already installed on Lambda, but will install numpy:
```
numpy
boto3 #no-deploy
botocore #no-deploy
docutils #no-deploy
jmespath #no-deploy
python-dateutil #no-deploy
s3transfer #no-deploy
six #no-deploy
```

## Manual invocations

The `.requirements` and `requirements.zip`(if using zip support) files are left
behind to speed things up on subsequent deploys. To clean them up, run
`sls requirements clean`. You can also create them (and `unzip_requirements` if
using zip support) manually with `sls requirements install`.


## Updating to python 3.6

This requires an update to your serverless.yml:

```
provider:
  name: aws
  runtime: python3.6
```

And be sure to clean up `.requirements` or `requirements.zip` if they exist as
python2.7 and python3.6 code can't coexist.


## Credit
This plugin is influenced by
[serverless-wsgi](https://github.com/logandk/serverless-wsgi) from
[@logandk](https://github.com/logandk). I however wanted a simpler pip install
process. It now also supports bundling packages without the wsgi handler.
