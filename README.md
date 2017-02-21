# Serverless Python Requirements

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)

[![npm](https://nodei.co/npm/serverless-python-requirements.png?downloads=true&downloadRank=true)](https://www.npmjs.com/package/serverless-python-requirements)

A Serverless v1.0 plugin to automatically bundle dependencies from 
`requirements.txt` and make them available in your `PYTHONPATH`.


## Install

```
npm install --save serverless-python-requirements
```

Add the plugin to your `serverless.yml`:

```yaml
plugins:
  - serverless-python-requirements
```


## Adding the dependencies to `sys.path`

### Automatic
The default behavior of this plugin is to link libraries into the working tree
during deployment so that they are in your handler's `PYTHONPATH` when running
on lambda.

### Manual
This method is required when using [ZipImport](#zipimport) support and can be
enabled manually by adding the following option to your config:

```yaml
custom:
  pythonRequirements:
    link: false
```

`serverless-python-requirements` adds a module called `requirements` to your
puck. To easily make the bundled dependencies available, simply import it. Eg.
add this to the top of any file using dependencies specified in your
`requirements.txt`:
```python
import requirements
# Now you can use deps you specified in requirements.txt!
import requests
```

## Cross compiling!
Compiling non-pure-Python modules is supported on MacOS via the use of Docker
and the [docker-lambda](https://github.com/lambci/docker-lambda) image.
To enable docker usage, add the following to your `serverless.yml`:
```yaml
custom:
  pythonRequirements:
    dockerizePip: true
```

## ZipImport!
To help deal with potentially large dependencies (for example: `numpy`, `scipy`
and `scikit-learn`) there is support for having python import using
[zipimport](https://docs.python.org/2.7/library/zipimport.html). To enable this
add the following to your  `serverless.yml`:
```yaml
custom:
  pythonRequirements:
    zipImport: true
```


## Limitations
 * if using the `package` directive in `serverless.yml` ensure that
`requirements.py` is are included as well as `.requirements` or
`.requirements.zip` if using [ZipImport](#zipimport).


## Manual invocations

The `.requirements` and `requirements.py` files are left behind to simplify
development. To clean them up, run `sls requirements clean`. You can also
install them manually for local development with `sls requirements install`.

## Credit
This plugin is influenced by
[serverless-wsgi](https://github.com/logandk/serverless-wsgi) from
[@logandk](https://github.com/logandk). I however wanted a simpler pip install
process. It now also supports bundling packages without the wsgi handler.
