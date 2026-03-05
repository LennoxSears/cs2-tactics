import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBold, faItalic, faStrikethrough, faListUl, faListOl,
  faCode, faImage, faLink, faVideo, faQuoteLeft,
} from '@fortawesome/free-solid-svg-icons';

interface Props {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  compact?: boolean; // smaller toolbar for inline use (token notes, comments)
}

// Content is stored as JSON string. Plain text from old data is auto-wrapped.
function parseContent(raw: string): any {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.type === 'doc') return parsed;
  } catch { /* not JSON */ }
  // Plain text fallback — wrap in a doc
  return {
    type: 'doc',
    content: raw.split('\n').filter(Boolean).map(line => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    })),
  };
}

export default function RichEditor({ content, onChange, placeholder, compact }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: compact ? false : { levels: [3] },
      }),
      Image.configure({ inline: true, allowBase64: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Youtube.configure({ width: 480, height: 270 }),
      Placeholder.configure({ placeholder: placeholder || 'Write something...' }),
    ],
    content: parseContent(content),
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (!editor) return;
    const parsed = parseContent(content);
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(parsed);
    if (current !== incoming && parsed) {
      editor.commands.setContent(parsed, { emitUpdate: false });
    }
  }, [content]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = prompt('Image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = prompt('Link URL:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  const addVideo = useCallback(() => {
    if (!editor) return;
    const url = prompt('YouTube or video URL:');
    if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
  }, [editor]);

  // Handle paste images from clipboard
  useEffect(() => {
    if (!editor) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            editor.chain().focus().setImage({ src: base64 }).run();
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };
    const el = editor.view.dom;
    el.addEventListener('paste', handlePaste as EventListener);
    return () => el.removeEventListener('paste', handlePaste as EventListener);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={`rich-editor ${compact ? 'compact' : ''}`}>
      <div className="re-toolbar">
        <button
          className={`re-btn ${editor.isActive('bold') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <FontAwesomeIcon icon={faBold} />
        </button>
        <button
          className={`re-btn ${editor.isActive('italic') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <FontAwesomeIcon icon={faItalic} />
        </button>
        <button
          className={`re-btn ${editor.isActive('strike') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <FontAwesomeIcon icon={faStrikethrough} />
        </button>
        <span className="re-sep" />
        <button
          className={`re-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <FontAwesomeIcon icon={faListUl} />
        </button>
        <button
          className={`re-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <FontAwesomeIcon icon={faListOl} />
        </button>
        {!compact && (
          <>
            <button
              className={`re-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Quote"
            >
              <FontAwesomeIcon icon={faQuoteLeft} />
            </button>
            <button
              className={`re-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              title="Code block"
            >
              <FontAwesomeIcon icon={faCode} />
            </button>
          </>
        )}
        <span className="re-sep" />
        <button className="re-btn" onClick={addImage} title="Insert image">
          <FontAwesomeIcon icon={faImage} />
        </button>
        <button className="re-btn" onClick={addLink} title="Insert link">
          <FontAwesomeIcon icon={faLink} />
        </button>
        <button className="re-btn" onClick={addVideo} title="Embed video">
          <FontAwesomeIcon icon={faVideo} />
        </button>
      </div>
      <EditorContent editor={editor} className="re-content" />
    </div>
  );
}

// Read-only viewer for rich content
export function RichViewer({ content }: { content: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [3] } }),
      Image.configure({ inline: true, allowBase64: true }),
      Link.configure({ openOnClick: true }),
      Youtube.configure({ width: 480, height: 270 }),
    ],
    content: parseContent(content),
    editable: false,
  });

  useEffect(() => {
    if (!editor) return;
    const parsed = parseContent(content);
    if (parsed) editor.commands.setContent(parsed, { emitUpdate: false });
  }, [content]);

  if (!editor) return null;
  if (!content) return null;

  return (
    <div className="rich-viewer">
      <EditorContent editor={editor} />
    </div>
  );
}
