import os
import sys
import zipfile


zip_requirements = os.path.join(
    os.path.split(__file__)[0], '.requirements.zip')

tempdir = '/tmp/sls-py-req'

sys.path.append(tempdir)

if not os.path.exists(tempdir):
    zipfile.ZipFile(zip_requirements, 'r').extractall(tempdir)
