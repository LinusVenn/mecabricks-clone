import os, shutil
d = os.environ.get('JOULE_TOOL_RESULTS_DIR', '')
print('JOULE_TOOL_RESULTS_DIR:', repr(d))
if d and os.path.isdir(d):
    files = os.listdir(d)
    print('Files:', files)
    for f in files:
        if 'lego' in f.lower():
            src = os.path.join(d, f)
            dst = 'src/catalog/data/lego-colors.json'
            shutil.copy2(src, dst)
            print(f'Copied {src} -> {dst}')
else:
    print('Directory not found or empty')
    # Check common scratch locations
    for loc in ['/tmp', '/var/tmp', os.path.expanduser('~')]:
        try:
            items = os.listdir(loc)
            lego = [x for x in items if 'lego' in x.lower()]
            if lego:
                print(f'Found in {loc}:', lego)
        except Exception as e:
            print(f'{loc}: {e}')
