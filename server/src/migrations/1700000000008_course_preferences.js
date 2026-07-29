/* eslint-disable camelcase */

// Per-user, per-course personalization: color, favorite, and "archived from
// my dashboard" are all things a course's instructor AND every enrolled
// student can set independently of each other — none of it is a property of
// the course itself. One row per (user, course) covers both roles uniformly.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE course_preferences (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      color text NOT NULL,
      favorite boolean NOT NULL DEFAULT false,
      archived boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, course_id)
    );
  `);
  pgm.sql(`CREATE INDEX idx_course_preferences_user ON course_preferences(user_id);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS course_preferences;`);
};
