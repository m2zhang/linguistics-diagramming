/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`CREATE TYPE assignment_mode AS ENUM ('blank', 'template');`);

  pgm.sql(`
    CREATE TABLE assignments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      lecture_id uuid REFERENCES lectures(id) ON DELETE SET NULL,
      title text NOT NULL,
      instructions text,
      mode assignment_mode NOT NULL,
      template_content jsonb,
      due_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT template_requires_content
        CHECK (mode <> 'template' OR template_content IS NOT NULL)
    );
  `);
  pgm.sql(`CREATE INDEX idx_assignments_course ON assignments(course_id, due_at);`);
  pgm.sql(`CREATE INDEX idx_assignments_lecture ON assignments(lecture_id);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS assignments;`);
  pgm.sql(`DROP TYPE IF EXISTS assignment_mode;`);
};
