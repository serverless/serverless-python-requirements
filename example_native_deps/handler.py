# must be called as we're using zipped requirements
try:
    import unzip_requirements
except ImportError:
    pass

import numpy
import scipy
import sklearn


def hello(event, context):
    return {mod.__name__: mod.__version__ for mod in (numpy, scipy, sklearn)}
