import bcrypt from "bcryptjs";

const saltRounds = 12;

export function hashValue(value) {
  return bcrypt.hash(value, saltRounds);
}

export function compareHash(value, hash) {
  return bcrypt.compare(value, hash);
}
