import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import '../styles/faq.css';

export default function FAQ() {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const faqs = [
    {
      category: 'Import & Migration',
      items: [
        {
          question: 'How do I import my notes from other apps?',
          answer: `NoteSync supports importing from all major note-taking applications:

• **Evernote** - Export your notes as .enex files from Evernote's export feature
• **Google Keep** - Export your Google Takeout data as JSON
• **Apple Notes** - Export via Share > Save as HTML or use a third-party export tool
• **OneNote** - Export notebooks as HTML files
• **Text & Markdown** - Import plain text or .md files directly

To import, open NoteSync, go to Settings > Import, and follow the guided import process. You'll see a preview of all notes, folders, and tags before importing.`,
          tags: ['import', 'migration', 'competitors']
        },
        {
          question: 'Can I import from Notion?',
          answer: `Not yet, but it's on our roadmap. For now, you can:

1. Export your Notion workspace as Markdown using Notion's "Export" feature
2. Import the Markdown files into NoteSync
3. We're working on native Notion integration - check back soon!

If you need Notion support urgently, email support@notesync.9gg.app with your use case.`,
          tags: ['notion', 'import', 'roadmap']
        },
        {
          question: 'Will my formatting be preserved when I import?',
          answer: `Most formatting is preserved during import:

✓ **Preserved:** Bold, italic, underline, lists, code blocks, links, tables
✗ **Not preserved:** Custom colors, font families, some complex nested formatting

We automatically detect formatting in exported files and recreate it as closely as possible. If you notice formatting issues after import, please report them so we can improve our parsers.`,
          tags: ['import', 'formatting']
        },
        {
          question: 'Can I import notes from multiple apps at once?',
          answer: `Yes! You can import from multiple sources in a single process:

1. Open the import screen
2. Select multiple files (Evernote + Google Keep + OneNote, etc.)
3. NoteSync will parse all of them together
4. Preview everything before importing
5. Import all notes with a single tap

This makes it easy to consolidate your notes from multiple platforms.`,
          tags: ['import', 'multiple', 'migration']
        },
        {
          question: 'What happens if I have duplicate notes when importing?',
          answer: `NoteSync's import feature automatically detects potential duplicates:

• **Exact matches** - identical title and content (won't import)
• **Possible duplicates** - similar content or titles (you choose)

During the preview step, duplicates are highlighted with a yellow badge. You can:
- Deselect duplicates before importing
- Import them anyway (they won't create exact duplicates)
- The system prevents creating true duplicates by title + content

This keeps your NoteSync library clean and organized.`,
          tags: ['import', 'duplicates', 'organization']
        },
        {
          question: 'Can I import archived or trashed notes?',
          answer: `Yes! The import screen has toggles for:

• **Include Archived** - Import archived notes from Google Keep
• **Include Trashed** - Import trashed notes from Google Keep

For Evernote and Apple Notes, archived/trashed items are included by default. You can deselect them in the preview if you don't want them.`,
          tags: ['import', 'archived', 'google-keep']
        }
      ]
    },
    {
      category: 'Data Transfer & Safety',
      items: [
        {
          question: 'Is my data safe when importing?',
          answer: `Absolutely. Import is 100% private and local:

🔒 **Your data never leaves your device** - All parsing happens locally
🔐 **End-to-end encrypted** - Data is encrypted before leaving your device
✅ **No servers process your files** - We never store import files
🗑️ **Automatic cleanup** - Temporary files are deleted after import

Your notes are yours alone. We never sell, share, or analyze import data.`,
          tags: ['security', 'privacy', 'data']
        },
        {
          question: 'Can I export my notes from NoteSync?',
          answer: `Yes! You can export in multiple formats:

• **JSON** - Full data export (notes, folders, tags, metadata)
• **Markdown** - Plain text with formatting preserved
• **HTML** - Formatted web view
• **PDF** - Print-ready format

From Settings > Export, choose your format and NoteSync generates a downloadable file. Perfect for backups or switching to another app.`,
          tags: ['export', 'backup', 'portability']
        },
        {
          question: 'Will importing delete my existing notes?',
          answer: `Never. Import is **additive only**:

✓ Imported notes are added to your library
✓ Existing notes stay exactly as they are
✓ Folders and tags are created or merged as needed
✓ No data is ever deleted during import

You can safely import multiple times, and nothing will be overwritten or lost.`,
          tags: ['import', 'safety', 'backup']
        },
        {
          question: 'How much data can I import at once?',
          answer: `NoteSync can handle large imports:

• **Single import**: Up to 50,000 notes per session
• **File size**: Up to 500MB per import file
• **Total storage**: Depends on your plan (Free: 2GB, Pro: Unlimited)

For very large migrations (100k+ notes), contact support@notesync.9gg.app and we'll help you in batches.`,
          tags: ['import', 'limits', 'storage']
        }
      ]
    },
    {
      category: 'Comparing to Competitors',
      items: [
        {
          question: 'How does NoteSync compare to Evernote?',
          answer: `**NoteSync Advantages:**
✓ Unlimited notes on all plans (Evernote limits storage)
✓ 100% affordable pricing ($3.99/mo vs Evernote $12.99/mo)
✓ Open import from Evernote - never locked in
✓ Modern UI designed for 2026+
✓ End-to-end encryption by default
✓ No subscription trap

**Evernote Advantages:**
• Longer history/maturity
• More integrations (though catch-up is fast)

**Migration:** Easily import all your Evernote notes - takes 2 minutes.`,
          tags: ['comparison', 'evernote', 'pricing']
        },
        {
          question: 'How does NoteSync compare to Apple Notes?',
          answer: `**NoteSync Advantages:**
✓ Works cross-platform (Windows, Linux, web)
✓ Better organization (notebooks, folders, tags)
✓ Powerful search and filtering
✓ Export & backup features
✓ Affordable for power users

**Apple Notes Advantages:**
• Built into iOS/macOS ecosystem
• Tight integration with Siri

**Migration:** Your Apple Notes sync to your Mac. Export as HTML and import into NoteSync. Access your notes anywhere.`,
          tags: ['comparison', 'apple-notes', 'cross-platform']
        },
        {
          question: 'How does NoteSync compare to Notion?',
          answer: `**NoteSync is simpler & faster:**
✓ Notes load instantly (Notion can be slow)
✓ No learning curve (Notion has a steep curve)
✓ Affordable ($3.99/mo vs Notion's $10/mo+)
✓ Dedicated to notes (Notion does everything)
✓ Better offline support

**Notion is more flexible:**
• More customizable (databases, relations, etc.)
• Better for team collaboration
• Works for dashboards, wikis, databases

**Migration:** Export Notion as Markdown and import directly. Works great!`,
          tags: ['comparison', 'notion', 'simplicity']
        },
        {
          question: 'Can I use NoteSync and Evernote together?',
          answer: `Yes! Many users do:

**Strategy 1: Gradual Migration**
- Import old Evernote notes to NoteSync
- Use NoteSync for new notes
- Keep Evernote for reference/archive

**Strategy 2: Dual System**
- Use Evernote for work
- Use NoteSync for personal notes
- Export & import as needed

**Strategy 3: Backup**
- Use NoteSync as primary
- Export to Evernote monthly for backup

NoteSync is designed for easy import/export, so you're never locked in.`,
          tags: ['comparison', 'multi-app', 'workflow']
        }
      ]
    },
    {
      category: 'Getting Started',
      items: [
        {
          question: 'What's the best way to start with NoteSync?',
          answer: `**Step 1:** Sign up for free - no credit card needed
**Step 2:** Create a few test notes to learn the app
**Step 3:** Import your existing notes from another app
**Step 4:** Organize into folders and tag your notes
**Step 5:** Explore AI features (Starter+) to enhance notes
**Step 6:** Set up sync across devices

That's it! Most users feel at home in 5 minutes.`,
          tags: ['getting-started', 'tutorial', 'onboarding']
        },
        {
          question: 'Do I need to export my notes before leaving Evernote/Apple Notes?',
          answer: `No, but it's recommended. Our process:

1. Keep your old account active (export stays available)
2. Import everything to NoteSync
3. Use NoteSync for all new notes
4. Once confident, cancel your old subscription

Your original notes stay where they are - import copies them. No data is deleted from the original source.`,
          tags: ['migration', 'transition', 'safety']
        },
        {
          question: 'Is there a way to try NoteSync free before importing?',
          answer: `Absolutely! NoteSync Free Plan includes:

✓ Unlimited notes (never expires)
✓ Full import capability
✓ 2GB storage
✓ All core features
✓ Cross-platform access

Start free, import your notes, and only upgrade if you want AI features or more storage. No risk, no commitment.`,
          tags: ['free-trial', 'pricing', 'no-commitment']
        }
      ]
    }
  ];

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const allItems = faqs.flatMap((cat, catIdx) =>
    cat.items.map((item, itemIdx) => ({
      ...item,
      category: cat.category,
      id: `${catIdx}-${itemIdx}`
    }))
  );

  return (
    <div className="faq-container">
      <div className="faq-header">
        <h1>Frequently Asked Questions</h1>
        <p>Everything you need to know about importing to NoteSync</p>
      </div>

      <div className="faq-content">
        {faqs.map((category, categoryIdx) => (
          <div key={categoryIdx} className="faq-category">
            <h2 className="category-title">{category.category}</h2>
            <div className="faq-list">
              {category.items.map((item, itemIdx) => {
                const id = `${categoryIdx}-${itemIdx}`;
                const isExpanded = expandedIndex === id;

                return (
                  <div
                    key={id}
                    className={`faq-item ${isExpanded ? 'expanded' : ''}`}
                  >
                    <button
                      className="faq-question"
                      onClick={() => toggleExpand(id)}
                    >
                      <span>{item.question}</span>
                      <ChevronDown
                        size={20}
                        className={`chevron ${isExpanded ? 'open' : ''}`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="faq-answer">
                        <p>{item.answer}</p>
                        <div className="faq-tags">
                          {item.tags.map((tag, i) => (
                            <span key={i} className="tag">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="faq-footer">
        <h3>Didn't find your answer?</h3>
        <p>Email us at support@notesync.9gg.app or check our Help Center</p>
        <a href="/help" className="help-link">
          Visit Help Center →
        </a>
      </div>
    </div>
  );
}
