/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE drafts (
      assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (assignment_id, student_id)
    );
  `);

  pgm.sql(`
    CREATE TABLE submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content jsonb NOT NULL,
      submitted_at timestamptz NOT NULL DEFAULT now(),
      grade numeric(5,2),
      feedback text,
      graded_at timestamptz,
      graded_by uuid REFERENCES users(id) ON DELETE SET NULL
    );
  `);
  pgm.sql(`CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);`);
  pgm.sql(`CREATE INDEX idx_submissions_student ON submissions(student_id);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS submissions;`);
  pgm.sql(`DROP TABLE IF EXISTS drafts;`);
};
