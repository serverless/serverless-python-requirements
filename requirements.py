import os
import sys


requirements = os.path.join(
    os.path.split(__file__)[0], '.requirements')
zip_requirements = os.path.join(
    os.path.split(__file__)[0], '.requirements.zip')

if requirements not in sys.path:
    sys.path.append(requirements)

if zip_requirements not in sys.path:
    sys.path.append(zip_requirements)
