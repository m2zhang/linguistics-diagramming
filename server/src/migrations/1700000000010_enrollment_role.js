/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`CREATE TYPE course_role AS ENUM ('student', 'ta');`);
  pgm.sql(`
    ALTER TABLE enrollments 
    ADD COLUMN role course_role NOT NULL DEFAULT 'student';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE enrollments DROP COLUMN role;`);
  pgm.sql(`DROP TYPE IF EXISTS course_role;`);
};
