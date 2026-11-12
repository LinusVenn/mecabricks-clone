// Vitest programmatisch starten
const path = require('path');

async function run() {
    // Dynamischer Import von vitest/node (ESM-kompatibel)
    const { startVitest } = await import('vitest/node');

    const vitest = await startVitest('test', [], {
        run: true,
        root: path.resolve(__dirname),
        config: path.resolve(__dirname, 'vitest.config.js'),
        reporter: ['verbose'],
    });

    const failed = vitest.state.getCountOfFailedTests();
    await vitest.close();
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
