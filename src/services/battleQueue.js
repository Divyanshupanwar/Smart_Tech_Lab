const crypto = require('crypto');
const redisClient = require('../config/redis');

const MATCH_SCRIPT = `
local userId = ARGV[1]
local now = tonumber(ARGV[2])
local activePrefix = ARGV[3]
local queueUserPrefix = ARGV[4]
local config = ARGV[5]
local targetPlayers = tonumber(ARGV[6]) or 2
local userActiveKey = activePrefix .. userId
local existing = redis.call('GET', userActiveKey)
if existing then
  if existing ~= 'WAITING' then return {0, existing} end
  local oldQueueKey = redis.call('GET', queueUserPrefix .. userId)
  if oldQueueKey == KEYS[1] then return {0, existing} end
  if oldQueueKey then
    redis.call('ZREM', oldQueueKey, userId)
    redis.call('HDEL', oldQueueKey .. ':meta', userId)
  end
  redis.call('DEL', userActiveKey, queueUserPrefix .. userId)
end
local candidates = redis.call('ZRANGE', KEYS[1], 0, 99)
local selected = {}
for _, candidate in ipairs(candidates) do
  if candidate ~= userId and #selected < targetPlayers - 1 then
    local candidateActive = redis.call('GET', activePrefix .. candidate)
    local candidateConfig = redis.call('HGET', KEYS[2], candidate)
    if candidateActive == 'WAITING' and candidateConfig then
      table.insert(selected, candidate)
    else
      redis.call('ZREM', KEYS[1], candidate)
      redis.call('HDEL', KEYS[2], candidate)
      redis.call('DEL', queueUserPrefix .. candidate)
    end
  end
end
if #selected >= targetPlayers - 1 then
  for _, candidate in ipairs(selected) do
    redis.call('ZREM', KEYS[1], candidate)
    redis.call('HDEL', KEYS[2], candidate)
    redis.call('DEL', queueUserPrefix .. candidate)
    redis.call('SET', activePrefix .. candidate, 'MATCHED', 'EX', 240)
  end
  redis.call('SET', userActiveKey, 'MATCHED', 'EX', 240)
  return {1, cjson.encode(selected)}
end
redis.call('SET', userActiveKey, 'WAITING', 'EX', 180)
redis.call('ZADD', KEYS[1], now, userId)
redis.call('HSET', KEYS[2], userId, config)
redis.call('SET', queueUserPrefix .. userId, KEYS[1], 'EX', 180)
redis.call('EXPIRE', KEYS[1], 180)
redis.call('EXPIRE', KEYS[2], 180)
return {2}
`;

const RESERVE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
return 1
`;

const RELEASE_SCRIPT = `
for i, key in ipairs(KEYS) do
  if redis.call('GET', key) == ARGV[1] then redis.call('DEL', key) end
end
return 1
`;

const CANCEL_QUEUE_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= 'WAITING' then return 0 end
local queueKey = redis.call('GET', KEYS[2])
if queueKey then
  redis.call('ZREM', queueKey, ARGV[1])
  redis.call('HDEL', queueKey .. ':meta', ARGV[1])
end
redis.call('DEL', KEYS[1], KEYS[2])
return 1
`;

const UPDATE_IF_MATCH_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  return 1
end
return 0
`;

const playerKey = (userId) => `battle:player:${userId}`;

const buildQueueKey = ({ subject, difficulty, durationMinutes, questionCount, playerCount = 4, topic }) => (
    `battle:queue:${subject}:${difficulty}:${durationMinutes}:${questionCount}:${encodeURIComponent(topic || 'any')}:${playerCount}`
);

const findBattleGroup = async (userId, config) => {
    if (!redisClient.isOpen) throw new Error('Redis is required for matchmaking.');
    const queueKey = buildQueueKey(config);
    const metaKey = `${queueKey}:meta`;
    const result = await redisClient.eval(MATCH_SCRIPT, {
        keys: [queueKey, metaKey],
        arguments: [
            String(userId),
            String(Date.now()),
            'battle:player:',
            'battle:queue:user:',
            JSON.stringify(config),
            String(config.playerCount || 4)
        ]
    });
    const code = Number(result?.[0]);
    if (code === 0) return { state: 'already_active', activeValue: result[1] };
    if (code === 1) return { state: 'matched', playerIds: JSON.parse(String(result[1])) };
    return { state: 'waiting' };
};

const cancelQueue = async (userId) => {
    if (!redisClient.isOpen) return false;
    const id = String(userId);
    const result = await redisClient.eval(CANCEL_QUEUE_SCRIPT, {
        keys: [playerKey(id), `battle:queue:user:${id}`],
        arguments: [id]
    });
    return Number(result) === 1;
};

const reservePlayers = async (userIds) => {
    if (!redisClient.isOpen) throw new Error('Redis is required to start a battle.');
    const ids = userIds.map(String);
    if (ids.length < 2 || ids.length > 16 || new Set(ids).size !== ids.length) return null;
    const token = crypto.randomUUID();
    const result = await redisClient.eval(RESERVE_SCRIPT, {
        keys: ids.map(playerKey),
        arguments: [token, '240']
    });
    return Number(result) === 1 ? token : null;
};

const releaseReservedPlayers = async (userIds, token) => {
    if (!redisClient.isOpen || !token) return;
    await redisClient.eval(RELEASE_SCRIPT, { keys: userIds.map((id) => playerKey(String(id))), arguments: [token] });
};

const setBattlePlayers = async (userIds, battleId, ttlSeconds) => {
    if (!redisClient.isOpen) return;
    await Promise.all(userIds.map((id) => redisClient.set(playerKey(String(id)), String(battleId), { EX: ttlSeconds })));
};

const releaseBattlePlayers = async (userIds, battleId) => {
    if (!redisClient.isOpen) return;
    await redisClient.eval(RELEASE_SCRIPT, { keys: userIds.map((id) => playerKey(String(id))), arguments: [String(battleId)] });
};

const releaseMatchedPlayers = async (userIds) => {
    if (!redisClient.isOpen) return;
    await redisClient.eval(RELEASE_SCRIPT, { keys: userIds.map((id) => playerKey(String(id))), arguments: ['MATCHED'] });
};

const acquireLock = async (key, ttlMs = 8000, waitMs = 2000) => {
    if (!redisClient.isOpen) throw new Error('Redis is required for battle state coordination.');
    const token = crypto.randomUUID();
    const startedAt = Date.now();
    while (Date.now() - startedAt < waitMs) {
        if (await redisClient.set(key, token, { NX: true, PX: ttlMs })) return token;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
};

const releaseLock = async (key, token) => {
    if (!redisClient.isOpen || !token) return;
    await redisClient.eval(RELEASE_SCRIPT, { keys: [key], arguments: [token] });
};

module.exports = {
    acquireLock,
    buildQueueKey,
    cancelQueue,
    findBattleGroup,
    playerKey,
    releaseBattlePlayers,
    releaseLock,
    releaseMatchedPlayers,
    releaseReservedPlayers,
    reservePlayers,
    setBattlePlayers
};
