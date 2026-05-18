// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import Field from '../../app/components/ui/Field.vue'

const SlotProbe = defineComponent({
  props: ['id', 'ariaDescribedby', 'ariaInvalid'],
  setup(props) {
    return () => h('input', {
      'data-test-id': props.id,
      'aria-describedby': props.ariaDescribedby,
      'aria-invalid': props.ariaInvalid
    })
  }
})

function mountField(props: Record<string, unknown> = {}) {
  return mount(Field, {
    props,
    slots: {
      default: (slotProps: any) => h(SlotProbe, slotProps)
    }
  })
}

describe('UiField', () => {
  it('renders label tied to the slot input via id', () => {
    const wrapper = mountField({ label: 'Email' })
    const label = wrapper.get('label')
    const input = wrapper.get('input')
    expect(label.text()).toBe('Email')
    expect(label.attributes('for')).toBe(input.attributes('data-test-id'))
  })

  it('renders the required marker only when required', () => {
    expect(mountField({ label: 'Name' }).find('span[aria-hidden="true"]').exists()).toBe(false)
    const required = mountField({ label: 'Name', required: true })
    const marker = required.get('span[aria-hidden="true"]')
    expect(marker.text()).toBe('*')
    expect(marker.classes()).toContain('text-danger')
  })

  it('exposes hint via aria-describedby (only when no error)', () => {
    const wrapper = mountField({ label: 'Name', hint: 'Use your full name.' })
    const hint = wrapper.get('p')
    expect(hint.text()).toBe('Use your full name.')
    expect(hint.classes()).toContain('text-muted')
    const input = wrapper.get('input')
    expect(input.attributes('aria-describedby')).toBe(hint.attributes('id'))
    expect(input.attributes('aria-invalid')).toBeUndefined()
  })

  it('replaces hint with error and sets aria-invalid', () => {
    const wrapper = mountField({ label: 'Name', hint: 'Use your full name.', error: 'Required.' })
    const paragraphs = wrapper.findAll('p')
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0]!.text()).toBe('Required.')
    expect(paragraphs[0]!.classes()).toContain('text-danger')
    const input = wrapper.get('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe(paragraphs[0]!.attributes('id'))
  })

  it('honors caller-supplied `for` as the slot id', () => {
    const wrapper = mountField({ label: 'Name', for: 'caller-id' })
    expect(wrapper.get('label').attributes('for')).toBe('caller-id')
    expect(wrapper.get('input').attributes('data-test-id')).toBe('caller-id')
  })
})