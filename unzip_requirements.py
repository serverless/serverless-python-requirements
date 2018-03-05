import os
import shutil
import sys
import zipfile


pkgdir = '/tmp/sls-py-req'

sys.path.append(pkgdir)

if not os.path.exists(pkgdir):
    tempdir = '/tmp/_temp-sls-py-req'
    if os.path.exists(tempdir):
        shutil.rmtree(tempdir)

    zip_requirements = os.path.join(
        os.environ.get('LAMBDA_TASK_ROOT', os.getcwd()), '.requirements.zip')

    zipfile.ZipFile(zip_requirements, 'r').extractall(tempdir)
    os.rename(tempdir, pkgdir)  # Atomic
