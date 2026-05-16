import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from '../../app/components/ui/Button.vue'

describe('UiButton', () => {
  it('defaults to primary md', () => {
    const wrapper = mount(Button, { slots: { default: 'Save' } })
    const button = wrapper.get('button')
    expect(button.attributes('data-variant')).toBe('primary')
    expect(button.attributes('data-size')).toBe('md')
    expect(button.classes()).toContain('bg-accent')
    expect(button.classes()).toContain('text-accent-fg')
    expect(button.text()).toBe('Save')
  })

  it.each([
    ['primary', 'bg-accent'],
    ['secondary', 'border-border-default'],
    ['ghost', 'text-text-soft'],
    ['danger', 'bg-danger']
  ] as const)('renders %s variant with %s', (variant, expectedClass) => {
    const wrapper = mount(Button, { props: { variant } })
    expect(wrapper.get('button').attributes('data-variant')).toBe(variant)
    expect(wrapper.get('button').classes()).toContain(expectedClass)
  })

  it.each([
    ['sm', 'h-8'],
    ['md', 'h-9']
  ] as const)('renders %s size with %s', (size, expectedClass) => {
    const wrapper = mount(Button, { props: { size } })
    expect(wrapper.get('button').attributes('data-size')).toBe(size)
    expect(wrapper.get('button').classes()).toContain(expectedClass)
  })

  it('loading state shows spinner, disables button, sets aria-busy', () => {
    const wrapper = mount(Button, { props: { loading: true } })
    const button = wrapper.get('button')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBe('true')
    expect(wrapper.findComponent({ name: 'Spinner' }).exists() || wrapper.find('svg').exists()).toBe(true)
  })

  it('disabled prop disables the button without aria-busy', () => {
    const wrapper = mount(Button, { props: { disabled: true } })
    const button = wrapper.get('button')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBeUndefined()
  })

  it('block prop adds w-full', () => {
    const wrapper = mount(Button, { props: { block: true } })
    expect(wrapper.get('button').classes()).toContain('w-full')
  })

  it('respects focus-visible ring utility (catalyst rule)', () => {
    const wrapper = mount(Button)
    const classes = wrapper.get('button').classes().join(' ')
    expect(classes).toMatch(/focus-visible:outline-2/)
    expect(classes).toMatch(/focus-visible:outline-accent/)
  })
})
