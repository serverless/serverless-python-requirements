# Serverless Python Requirements

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)

A Serverless v1.0 plugin to automatically bundle dependencies from 
`requirements.txt`.


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

`serverless-python-requirements` adds a module called `requirements` to your
puck. To easily make the bundled dependencies available, simply import it. Eg.
add this to the top of any file using dependencies specified in your
`requirements.txt`:
```python
import requirements
# Now you can use deps you specified in requirements.txt!
import requests
```

## Limitations

 * MacOS & Windows: For now this only works with pure Python modules unless running serverless on the same architeture as AWS (x86_64 Linux).
 * if using the `package` directive in `serverless.yml` ensure that `.requirements` and `requirements.py` are included.


## Manual invocations

The `.requirements` and `requirements.py` files are left behind to simplify
development. To clean them up, run `sls requirements clean`. You can also
install them manually for local development with `sls requirements install`.

## Credit
This plugin is influenced by
[serverless-wsgi](https://github.com/logandk/serverless-wsgi) from
[@logandk](https://github.com/logandk). I however wanted a simpler pip install
process. It now also supports bundling packages without the wsgi handler.
