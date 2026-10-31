const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveJudge0Config } = require('../utils/judge0Config');

test('Judge0 config accepts RapidAPI credentials and the legacy key alias', () => {
    assert.deepEqual(resolveJudge0Config({ JUDGE0_API_KEY: 'test-key', JUDGE0_API_HOST: 'judge0.example' }), {
        baseUrl: 'https://judge0.example',
        headers: { 'x-rapidapi-key': 'test-key', 'x-rapidapi-host': 'judge0.example' },
        provider: 'rapidapi'
    });
    assert.equal(resolveJudge0Config({ RAPIDAPI_KEY: 'legacy-key' }).headers['x-rapidapi-key'], 'legacy-key');
});

test('Judge0 config accepts a self-hosted endpoint without a RapidAPI key', () => {
    assert.deepEqual(resolveJudge0Config({ JUDGE0_API_URL: 'http://127.0.0.1:2358/' }), {
        baseUrl: 'http://127.0.0.1:2358',
        headers: {},
        provider: 'self-hosted'
    });
    assert.equal(resolveJudge0Config({ JUDGE0_API_URL: 'https://judge.internal', JUDGE0_AUTH_TOKEN: 'secret' }).headers['X-Auth-Token'], 'secret');
    assert.equal(resolveJudge0Config({ JUDGE0_API_URL: 'https://judge.internal', JUDGE0_AUTH_TOKEN: 'secret', JUDGE0_AUTH_HEADER: 'X-Judge0-Token' }).headers['X-Judge0-Token'], 'secret');
});

test('Judge0 config reports missing or invalid settings without exposing secrets', () => {
    assert.throws(() => resolveJudge0Config({}), /Add JUDGE0_API_KEY/);
    assert.throws(() => resolveJudge0Config({ JUDGE0_API_URL: 'file:///tmp/judge0' }), /http or https/);
    assert.throws(() => resolveJudge0Config({ JUDGE0_API_HOST: 'https://bad-host/path', JUDGE0_API_KEY: 'test-key' }), /hostname/);
});
