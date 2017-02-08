import os
import sys


requirements = os.path.join(
    os.path.split(__file__)[0],
    '.requirements',
)

local_requirements = os.path.join(
    os.path.split(__file__)[0],
    '.local_requirements',
)

for path in [requirements, local_requirements]:
    if os.path.isdir(path) and path not in sys.path:
        sys.path.insert(1, path)
