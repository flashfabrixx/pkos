import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { CaptureInput, ExtractedKnowledge } from '@pkos/core'

export async function writeArchive(documentId: string, input: CaptureInput, extracted: ExtractedKnowledge) {
  const config = useRuntimeConfig()
  const vaultRoot = resolve(process.cwd(), config.vaultPath)
  const folder = folderFor(input.sourceType)
  const date = input.capturedAt || new Date().toISOString().slice(0, 10)
  const filename = `${date}-${slugify(input.title)}-${documentId.slice(0, 8)}.md`
  const absoluteDir = join(vaultRoot, folder)
  const absolutePath = join(absoluteDir, filename)
  const relativePath = join(folder, filename)

  await mkdir(absoluteDir, { recursive: true })
  await writeFile(absolutePath, renderMarkdown(input, extracted, relativePath), 'utf8')

  return relativePath
}

function folderFor(sourceType: CaptureInput['sourceType']) {
  if (sourceType === 'meeting') return 'meetings'
  if (sourceType === 'conversation') return 'conversations'
  if (sourceType === 'reflection') return 'reflections'
  return 'inbox'
}

function renderMarkdown(input: CaptureInput, extracted: ExtractedKnowledge, archivePath: string) {
  const frontmatter = [
    '---',
    `title: ${quote(input.title)}`,
    `source_type: ${input.sourceType}`,
    `confidentiality: ${input.confidentiality}`,
    `date: ${input.capturedAt || new Date().toISOString().slice(0, 10)}`,
    `participants: ${JSON.stringify(extracted.people)}`,
    `projects: ${JSON.stringify(extracted.projects)}`,
    `tags: ${JSON.stringify(extracted.tags)}`,
    `archive_path: ${quote(archivePath)}`,
    'status: processed',
    '---'
  ].join('\n')

  return `${frontmatter}

# ${input.title}

## Summary

${extracted.summary}

## People

${wikilinkList(extracted.people)}

## Projects / Topics

${wikilinkList(extracted.projects)}

## Action Items

${taskList(extracted.actionItems)}

## Decisions

${wikilinkList(extracted.decisions)}

## Insights

${wikilinkList(extracted.insights)}

## Open Questions

${wikilinkList(extracted.openQuestions)}

## Knowledge Links

${knowledgeLinks(input.title, extracted)}

## Original Text

\`\`\`text
${input.rawText.trim()}
\`\`\`
`
}

function list(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- none'
}

function wikilinkList(items: string[]) {
  return items.length ? items.map((item) => `- [[${escapeWikilink(item)}]]`).join('\n') : '- none'
}

function taskList(items: string[]) {
  return items.length ? items.map((item) => `- [ ] ${item}`).join('\n') : '- none'
}

function knowledgeLinks(title: string, extracted: ExtractedKnowledge) {
  const links = [
    title,
    ...extracted.people,
    ...extracted.projects,
    ...extracted.tags,
    ...extracted.decisions,
    ...extracted.insights,
    ...extracted.openQuestions
  ]
  return [...new Set(links.filter(Boolean))]
    .map((item) => `- [[${escapeWikilink(item)}]]`)
    .join('\n') || '- none'
}

function escapeWikilink(value: string) {
  return value.replace(/\]/g, '').replace(/\[/g, '').trim()
}

function quote(value: string) {
  return JSON.stringify(value)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'untitled'
}
