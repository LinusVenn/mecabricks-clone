content = open('tests/PhysicsSimulationController.test.js').read()
content = content.replace('        it(', '        maybeIt(')
open('tests/PhysicsSimulationController.test.js', 'w').write(content)
print('done, lines:', content.count('\n'))
