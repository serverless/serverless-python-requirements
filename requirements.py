import os
import sys


requirements = os.path.join(
    os.path.split(__file__)[0],
    '.requirements',
)

if requirements  not in sys.path:
    sys.path.append(requirements)
