import { View } from '@react-pdf/renderer'
import { formatEditorContent } from '@remio/pdf/format'

export function EditorContent({ content }: { content?: JSON }) {
  if (!content) {
    return null
  }

  return <View style={{ marginTop: 10 }}>{formatEditorContent(content)}</View>
}
