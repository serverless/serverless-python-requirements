#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
This module converts an AWS API Gateway proxied request to a WSGI request,
then loads the WSGI application specified by FQN in `.wsgi_app` and invokes
the request when the handler is called by AWS Lambda.

Inspired by: https://github.com/miserlou/zappa

Author: Logan Raarup <logan@logan.dk>
"""
import os
import sys
root = os.path.abspath(os.path.join(os.path.dirname(__file__)))
sys.path.insert(0, os.path.join(root, '.requirements'))

import importlib  # noqa: E402
from StringIO import StringIO  # noqa: E402
from werkzeug.datastructures import Headers  # noqa: E402
from werkzeug.wrappers import Response  # noqa: E402
from werkzeug.urls import url_encode  # noqa: E402
from werkzeug._compat import wsgi_encoding_dance  # noqa: E402

with open(os.path.join(root, '.wsgi_app'), 'r') as f:
    wsgi_fqn = f.read().rsplit('.', 1)
    wsgi_module = importlib.import_module(wsgi_fqn[0])
    wsgi_app = getattr(wsgi_module, wsgi_fqn[1])


def handler(event, context):
    headers = Headers(event[u'headers'])

    if headers.get(u'Host', u'').endswith(u'.amazonaws.com'):
        script_name = '/{}'.format(event[u'requestContext'].get(u'stage', ''))
    else:
        script_name = ''

    environ = {
        'CONTENT_LENGTH':
            headers.get(u'Content-Length', str(len(event[u'body'] or ''))),
        'CONTENT_TYPE':
            headers.get(u'Content-Type', ''),
        'PATH_INFO':
            event[u'path'],
        'QUERY_STRING':
            url_encode(event.get(u'queryStringParameters', None) or {}),
        'REMOTE_ADDR':
            headers.get(u'X-Forwarded-For', '').split(', ')[0],
        'REMOTE_USER':
            event[u'requestContext'].get(u'authorizer', {}).get(
                u'principalId', ''),
        'REQUEST_METHOD':
            event[u'httpMethod'],
        'SCRIPT_NAME':
            script_name,
        'SERVER_NAME':
            headers.get(u'Host', 'lambda'),
        'SERVER_PORT':
            headers.get(u'X-Forwarded-Port', '80'),
        'SERVER_PROTOCOL':
            'HTTP/1.1',
        'wsgi.errors':
            StringIO(),
        'wsgi.input':
            StringIO(wsgi_encoding_dance(event[u'body'] or '')),
        'wsgi.multiprocess':
            False,
        'wsgi.multithread':
            False,
        'wsgi.run_once':
            False,
        'wsgi.url_scheme':
            headers.get(u'X-Forwarded-Proto', 'http'),
        'wsgi.version':
            (1, 0),
    }

    for key, value in environ.items():
        if isinstance(value, basestring):
            environ[key] = wsgi_encoding_dance(value)

    for key, value in headers.items():
        key = 'HTTP_' + key.upper().replace('-', '_')
        if key not in ('HTTP_CONTENT_TYPE', 'HTTP_CONTENT_LENGTH'):
            environ[key] = value

    response = Response.from_app(wsgi_app, environ)

    errors = environ['wsgi.errors'].getvalue()
    if errors:
        print errors

    return {
        u'statusCode': response.status_code,
        u'headers': dict(response.headers),
        u'body': response.data
    }
