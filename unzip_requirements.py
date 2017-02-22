import os
import sys
import zipfile
import tempfile


zip_requirements = os.path.join(
    os.path.split(__file__)[0], '.requirements.zip')

tempdir = tempfile.mkdtemp()

sys.path.append(tempdir)

zipfile.ZipFile(zip_requirements, 'r').extractall(tempdir)
