import { startVitest } from 'vitest/node';

const vitest = await startVitest('test', [], {
    run: true,
    reporter: ['verbose'],
});

await vitest.close();
process.exit(vitest.state.getCountOfFailedTests() > 0 ? 1 : 0);
