/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE courses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      instructor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      title text NOT NULL,
      description text,
      join_code text UNIQUE NOT NULL,
      archived boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`CREATE INDEX idx_courses_instructor ON courses(instructor_id);`);

  pgm.sql(`
    CREATE TABLE enrollments (
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (course_id, student_id)
    );
  `);
  pgm.sql(`CREATE INDEX idx_enrollments_student ON enrollments(student_id);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS enrollments;`);
  pgm.sql(`DROP TABLE IF EXISTS courses;`);
};
