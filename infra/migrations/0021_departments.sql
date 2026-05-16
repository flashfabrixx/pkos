-- Department entity type + hierarchy + person/project memberships.
--
-- A "department" is a first-class entity. It can nest (parent_id), so a
-- workspace can model team → sub-team → squad over time. Persons and
-- projects are linked via dedicated relation rows so we can answer
-- "who belongs to which org" + "which projects this dept owns" without
-- having to scrape free text.

-- 1. Extend the entity-type whitelist.
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_type_check;
ALTER TABLE entities ADD CONSTRAINT entities_type_check
  CHECK (type IN ('person', 'project', 'topic', 'decision', 'insight', 'question', 'tag', 'document', 'department'));

-- 2. Hierarchy. A department's parent must also be a department; we
--    enforce that with an FK plus an application-level check on insert.
ALTER TABLE entities ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES entities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS entities_parent_idx ON entities (parent_id) WHERE parent_id IS NOT NULL;

-- 3. Person ↔ department + project ↔ department memberships. Stored as
--    rows in a single table keyed by (department, member, kind) so the
--    same department can hold both people and projects without a wider
--    schema. Kind is one of 'person' | 'project'.
CREATE TABLE IF NOT EXISTS department_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('person', 'project')),
  role TEXT,
  started_on DATE,
  ended_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, member_id, kind)
);
CREATE INDEX IF NOT EXISTS department_memberships_member_idx
  ON department_memberships (member_id);
CREATE INDEX IF NOT EXISTS department_memberships_department_idx
  ON department_memberships (department_id);

-- 4. Allow new knowledge_edge relation_types for the dept graph.
ALTER TABLE knowledge_edges DROP CONSTRAINT IF EXISTS knowledge_edges_relation_type_check;
ALTER TABLE knowledge_edges ADD CONSTRAINT knowledge_edges_relation_type_check
  CHECK (relation_type IN (
    'mentioned_with',
    'belongs_to_project',
    'assigned_to',
    'decided_in',
    'insight_about',
    'question_about',
    'tagged_as',
    'document_mentions',
    'belongs_to_department',
    'subdepartment_of'
  ));
