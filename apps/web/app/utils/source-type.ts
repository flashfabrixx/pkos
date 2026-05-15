import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  MicrophoneIcon,
  PencilSquareIcon,
  UserGroupIcon
} from '@heroicons/vue/24/outline'
import type { Component } from 'vue'

const SOURCE_TYPE_ICONS: Record<string, Component> = {
  meeting: UserGroupIcon,
  voice_note: MicrophoneIcon,
  conversation: ChatBubbleLeftRightIcon,
  reflection: PencilSquareIcon,
  other: DocumentTextIcon
}

export function sourceTypeIcon(type: string | null | undefined): Component {
  return SOURCE_TYPE_ICONS[String(type || '').toLowerCase()] || DocumentTextIcon
}
