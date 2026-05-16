import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const deptResult = await query(
    `SELECT id, type, name, canonical_name, metadata, parent_id, created_at, updated_at
       FROM entities
      WHERE id = $1 AND type = 'department' AND deleted_at IS NULL`,
    [id]
  )
  const department = deptResult.rows[0]
  if (!department) throw createError({ statusCode: 404, statusMessage: 'Department not found' })

  const [parent, children, people, projects] = await Promise.all([
    query(
      `SELECT id, name FROM entities WHERE id = $1 AND deleted_at IS NULL`,
      [department.parent_id || '00000000-0000-0000-0000-000000000000']
    ),
    query(
      `SELECT id, name FROM entities
        WHERE type = 'department' AND parent_id = $1 AND deleted_at IS NULL
        ORDER BY name`,
      [id]
    ),
    query(
      `SELECT m.id AS membership_id, m.role, m.started_on::text AS started_on, m.ended_on::text AS ended_on,
              e.id, e.name
         FROM department_memberships m
         JOIN entities e ON e.id = m.member_id
        WHERE m.department_id = $1 AND m.kind = 'person' AND e.deleted_at IS NULL
        ORDER BY e.name`,
      [id]
    ),
    query(
      `SELECT m.id AS membership_id, m.role, m.started_on::text AS started_on, m.ended_on::text AS ended_on,
              e.id, e.name
         FROM department_memberships m
         JOIN entities e ON e.id = m.member_id
        WHERE m.department_id = $1 AND m.kind = 'project' AND e.deleted_at IS NULL
        ORDER BY e.name`,
      [id]
    )
  ])

  return {
    department,
    parent: parent.rows[0] || null,
    children: children.rows,
    people: people.rows,
    projects: projects.rows
  }
})
