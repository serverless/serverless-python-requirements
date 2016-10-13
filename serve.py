#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
This module serves a WSGI application using werkzeug.

Author: Logan Raarup <logan@logan.dk>
"""
import importlib
import os
import sys

try:
    from werkzeug.serving import run_simple
except ImportError:
    sys.exit('Unable to import werkzeug (run: pip install werkzeug)')

if len(sys.argv) != 4:
    sys.exit('Usage: {} CWD APP PORT'.format(
        os.path.basename(sys.argv[0])))

CWD = sys.argv[1]
APP = sys.argv[2]
PORT = int(sys.argv[3])

sys.path.insert(0, CWD)

wsgi_fqn = APP.rsplit('.', 1)
wsgi_module = importlib.import_module(wsgi_fqn[0])
wsgi_app = getattr(wsgi_module, wsgi_fqn[1])

# Attempt to force Flask into debug mode
try:
    wsgi_app.debug = True
except:
    pass

run_simple('localhost', PORT, wsgi_app,
           use_debugger=True, use_reloader=True, use_evalex=True)
