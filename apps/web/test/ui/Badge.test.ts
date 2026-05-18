// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Badge from '../../app/components/ui/Badge.vue'

describe('UiBadge', () => {
  it('defaults to neutral', () => {
    const wrapper = mount(Badge, { slots: { default: 'Draft' } })
    const badge = wrapper.get('span')
    expect(badge.attributes('data-variant')).toBe('neutral')
    expect(badge.classes()).toContain('bg-soft')
    expect(badge.classes()).toContain('text-text-soft')
    expect(badge.text()).toBe('Draft')
  })

  it.each([
    ['accent', 'bg-accent-soft', 'text-accent'],
    ['success', 'bg-success-soft', 'text-success'],
    ['warning', 'bg-warning-soft', 'text-warning'],
    ['danger', 'bg-danger-soft', 'text-danger'],
    ['confidential', 'bg-accent-soft', 'text-confidential']
  ] as const)('renders %s variant', (variant, bgClass, textClass) => {
    const wrapper = mount(Badge, { props: { variant } })
    const badge = wrapper.get('span')
    expect(badge.attributes('data-variant')).toBe(variant)
    expect(badge.classes()).toContain(bgClass)
    expect(badge.classes()).toContain(textClass)
  })

  it('hides the leading dot by default', () => {
    const wrapper = mount(Badge)
    expect(wrapper.get('span').findAll('span')).toHaveLength(0)
  })

  it('renders a leading dot when dot=true with variant-matched colour', () => {
    const wrapper = mount(Badge, { props: { variant: 'success', dot: true } })
    const inner = wrapper.get('span').get('span')
    expect(inner.classes()).toContain('bg-success')
    expect(inner.classes()).toContain('rounded-full')
    expect(inner.attributes('aria-hidden')).toBe('true')
  })

  it('is a pill (rounded-full px-2 py-0.5 text-xs font-medium)', () => {
    const classes = mount(Badge).get('span').classes()
    expect(classes).toEqual(expect.arrayContaining(['rounded-full', 'px-2', 'py-0.5', 'text-xs', 'font-medium']))
  })
})