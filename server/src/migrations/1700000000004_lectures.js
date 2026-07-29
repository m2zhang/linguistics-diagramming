/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE lectures (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title text NOT NULL,
      notes text,
      position integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`CREATE INDEX idx_lectures_course ON lectures(course_id, position);`);

  pgm.sql(`
    CREATE TABLE lecture_trees (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lecture_id uuid NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
      title text NOT NULL,
      content jsonb NOT NULL,
      position integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`CREATE INDEX idx_lecture_trees_lecture ON lecture_trees(lecture_id, position);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS lecture_trees;`);
  pgm.sql(`DROP TABLE IF EXISTS lectures;`);
};
