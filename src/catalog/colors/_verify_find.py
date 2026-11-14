import os, shutil, glob

# Suche nach der Scratch-Datei
patterns = [
    os.path.join(os.getcwd(), '**', 'f5685db0__verify.mjs'),
    os.path.join(os.getcwd(), 'f5685db0__verify.mjs'),
]
found = None
for p in patterns:
    matches = glob.glob(p, recursive=True)
    if matches:
        found = matches[0]
        break

print('CWD:', os.getcwd())
print('Found:', found)

if found:
    dst = 'src/catalog/colors/_verify.mjs'
    shutil.copy2(found, dst)
    print('Copied to', dst)
else:
    # Liste aktuelle Verzeichnisse auf
    for root, dirs, files in os.walk(os.getcwd()):
        for f in files:
            if 'f5685db0' in f or '_verify' in f:
                print('Kandidat:', os.path.join(root, f))
