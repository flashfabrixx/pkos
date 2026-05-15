-- Step 1: Safety net — make sure every legacy people/projects/tags row has a matching entity.
-- (writeKnowledgeGraph should have created these on document processing, but we guard anyway.)
INSERT INTO entities (type, name, canonical_name, metadata)
SELECT 'person', name,
       lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g')),
       '{}'::jsonb
FROM people
ON CONFLICT (type, canonical_name) DO NOTHING;

INSERT INTO entities (type, name, canonical_name, metadata)
SELECT 'project', name,
       lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g')),
       '{}'::jsonb
FROM projects
ON CONFLICT (type, canonical_name) DO NOTHING;

INSERT INTO entities (type, name, canonical_name, metadata)
SELECT 'tag', name,
       lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g')),
       '{}'::jsonb
FROM tags
ON CONFLICT (type, canonical_name) DO NOTHING;

-- Step 2: Migrate action_items FKs from people/projects to entities.
-- Drop existing FKs first so the column values can be remapped.
ALTER TABLE action_items
  DROP CONSTRAINT IF EXISTS action_items_person_id_fkey,
  DROP CONSTRAINT IF EXISTS action_items_project_id_fkey;

-- Remap person_id and project_id by exact name match.
UPDATE action_items a
SET person_id = e.id
FROM people p
JOIN entities e ON e.type = 'person' AND e.name = p.name
WHERE a.person_id = p.id;

UPDATE action_items a
SET project_id = e.id
FROM projects p
JOIN entities e ON e.type = 'project' AND e.name = p.name
WHERE a.project_id = p.id;

-- Null out any rows that couldn't be remapped (defensive).
UPDATE action_items
SET person_id = NULL
WHERE person_id IS NOT NULL
  AND person_id NOT IN (SELECT id FROM entities);

UPDATE action_items
SET project_id = NULL
WHERE project_id IS NOT NULL
  AND project_id NOT IN (SELECT id FROM entities);

-- Add new FKs into entities(id).
ALTER TABLE action_items
  ADD CONSTRAINT action_items_person_entity_fkey
    FOREIGN KEY (person_id) REFERENCES entities(id) ON DELETE SET NULL,
  ADD CONSTRAINT action_items_project_entity_fkey
    FOREIGN KEY (project_id) REFERENCES entities(id) ON DELETE SET NULL;

-- Step 3: drop the now-redundant junction and legacy tables.
DROP TABLE IF EXISTS document_people;
DROP TABLE IF EXISTS document_projects;
DROP TABLE IF EXISTS document_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS people;
