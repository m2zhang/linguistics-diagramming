/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE assignments
    ADD COLUMN max_grade numeric(5,2);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE assignments
    DROP COLUMN max_grade;
  `);
};
