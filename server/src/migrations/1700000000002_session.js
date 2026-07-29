/* eslint-disable camelcase */

// Exact DDL required by connect-pg-simple, tracked here (createTableIfMissing: false
// in the app so the schema stays fully visible/versioned instead of being created
// implicitly at runtime).

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE "session" (
      sid varchar NOT NULL COLLATE "default" PRIMARY KEY,
      sess json NOT NULL,
      expire timestamp(6) NOT NULL
    );
  `);
  pgm.sql(`CREATE INDEX "IDX_session_expire" ON "session" ("expire");`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS "session";`);
};
