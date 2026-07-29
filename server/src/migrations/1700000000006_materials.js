/* eslint-disable camelcase */

// Dual-FK attachment table: a material belongs to exactly one of a lecture
// (lesson material) or an assignment (instructor reference file). Runs after
// both lectures and assignments exist so both FKs can be declared up front.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE materials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lecture_id uuid REFERENCES lectures(id) ON DELETE CASCADE,
      assignment_id uuid REFERENCES assignments(id) ON DELETE CASCADE,
      uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      original_name text NOT NULL,
      stored_name text NOT NULL UNIQUE,
      mime_type text NOT NULL,
      size_bytes bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT materials_one_owner CHECK (num_nonnulls(lecture_id, assignment_id) = 1)
    );
  `);
  pgm.sql(`CREATE INDEX idx_materials_lecture ON materials(lecture_id);`);
  pgm.sql(`CREATE INDEX idx_materials_assignment ON materials(assignment_id);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS materials;`);
};
