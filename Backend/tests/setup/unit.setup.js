// Runs before every UNIT test file. Unit tests never touch a database or the
// network, so this only provides deterministic env values that pure helpers
// (JWT signing, hashing) read from process.env.

process.env.JWT_ACCESS_SECRET ||= "test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
// Fast bcrypt rounds for tests only (utils/hash.js reads this; default stays 12 in the app).
process.env.BCRYPT_ROUNDS ||= "4";
