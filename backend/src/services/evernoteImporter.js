const xml2js = require('xml2js');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Evernote .enex file importer
 * Handles parsing ENEX XML and converting ENML to HTML
 */

class EvernoteImporter {
    constructor(db, userId) {
        this.db = db;
        this.userId = userId;
        this.parser = new xml2js.Parser({ explicitArray: false });
        this.importedNotes = [];
        this.importedTags = new Set();
        this.errors = [];
    }

    /**
     * Parse ENEX file and import notes
     */
    async importFromFile(filePath) {
        const content = await fs.readFile(filePath, 'utf8');
        return this.importFromString(content);
    }

    async importFromString(enexContent) {
        try {
            const result = await this.parser.parseStringPromise(enexContent);
            
            if (!result['en-export'] || !result['en-export'].note) {
                throw new Error('Invalid ENEX format: no notes found');
            }

            let notes = result['en-export'].note;
            
            // Handle single note case
            if (!Array.isArray(notes)) {
                notes = [notes];
            }

            // Get or create import folder
            const folderResult = await this.db.query(
                `INSERT INTO folders (user_id, name) 
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING
                 RETURNING id`,
                [this.userId, 'Evernote Import']
            );

            let folderId;
            if (folderResult.rows.length > 0) {
                folderId = folderResult.rows[0].id;
            } else {
                const existing = await this.db.query(
                    'SELECT id FROM folders WHERE user_id = $1 AND name = $2',
                    [this.userId, 'Evernote Import']
                );
                folderId = existing.rows[0].id;
            }

            // Import each note
            for (const note of notes) {
                try {
                    await this.importNote(note, folderId);
                } catch (err) {
                    this.errors.push({
                        note: note.title || 'Unknown',
                        error: err.message
                    });
                }
            }

            return {
                success: true,
                imported: this.importedNotes.length,
                tags: Array.from(this.importedTags),
                errors: this.errors
            };
        } catch (err) {
            throw new Error(`Failed to parse ENEX file: ${err.message}`);
        }
    }

    async importNote(noteData, folderId) {
        const title = noteData.title || 'Untitled';
        
        // Convert ENML content to HTML
        const content = this.convertEnmlToHtml(noteData.content || '');
        const contentPlain = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Parse timestamps
        const createdAt = this.parseEvernoteDate(noteData.created);
        const updatedAt = this.parseEvernoteDate(noteData.updated) || createdAt;

        // Check for duplicate by GUID if available
        const guid = noteData.guid || null;
        if (guid) {
            const existing = await this.db.query(
                'SELECT id FROM notes WHERE user_id = $1 AND evernote_guid = $2',
                [this.userId, guid]
            );
            if (existing.rows.length > 0) {
                // Update existing note
                await this.db.query(
                    `UPDATE notes SET 
                        title = $1, content = $2, content_plain = $3, updated_at = $4
                     WHERE id = $5`,
                    [title, content, contentPlain, updatedAt, existing.rows[0].id]
                );
                this.importedNotes.push({ id: existing.rows[0].id, title, updated: true });
                return existing.rows[0].id;
            }
        }

        // Insert new note
        const result = await this.db.query(
            `INSERT INTO notes 
                (user_id, folder_id, title, content, content_plain, created_at, updated_at, evernote_guid)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [this.userId, folderId, title, content, contentPlain, createdAt, updatedAt, guid]
        );

        const noteId = result.rows[0].id;
        this.importedNotes.push({ id: noteId, title, updated: false });

        // Handle tags
        if (noteData.tag) {
            const tags = Array.isArray(noteData.tag) ? noteData.tag : [noteData.tag];
            
            for (const tagName of tags) {
                this.importedTags.add(tagName);
                
                const tagResult = await this.db.query(
                    `INSERT INTO tags (user_id, name) VALUES ($1, $2)
                     ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
                     RETURNING id`,
                    [this.userId, tagName]
                );

                await this.db.query(
                    'INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [noteId, tagResult.rows[0].id]
                );
            }
        }

        // Handle attachments (resources)
        if (noteData.resource) {
            const resources = Array.isArray(noteData.resource) ? noteData.resource : [noteData.resource];
            
            for (const resource of resources) {
                try {
                    await this.importAttachment(noteId, resource);
                } catch (err) {
                    this.errors.push({
                        note: title,
                        attachment: resource.filename || 'unknown',
                        error: err.message
                    });
                }
            }
        }

        return noteId;
    }

    convertEnmlToHtml(enmlContent) {
        if (!enmlContent) return '';

        // Extract content from CDATA if present
        let content = enmlContent;
        const cdataMatch = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
        if (cdataMatch) {
            content = cdataMatch[1];
        }

        // Remove XML declaration and DOCTYPE
        content = content.replace(/<\?xml[^?]*\?>/gi, '');
        content = content.replace(/<!DOCTYPE[^>]*>/gi, '');

        // Convert en-note to div
        content = content.replace(/<en-note[^>]*>/gi, '<div class="note-content">');
        content = content.replace(/<\/en-note>/gi, '</div>');

        // Convert en-todo (checkboxes)
        content = content.replace(/<en-todo\s+checked="true"[^>]*\/>/gi, 
            '<input type="checkbox" checked disabled>');
        content = content.replace(/<en-todo[^>]*\/>/gi, 
            '<input type="checkbox" disabled>');

        // Convert en-media to placeholders (actual media handling would need more work)
        content = content.replace(/<en-media[^>]*hash="([^"]*)"[^>]*type="([^"]*)"[^>]*\/>/gi, 
            '<span class="attachment" data-hash="$1" data-type="$2">[Attachment]</span>');

        // Convert en-crypt (encrypted content)
        content = content.replace(/<en-crypt[^>]*>[\s\S]*?<\/en-crypt>/gi, 
            '<span class="encrypted">[Encrypted Content]</span>');

        // Clean up any remaining Evernote-specific tags
        content = content.replace(/<en-[^>]*>/gi, '');
        content = content.replace(/<\/en-[^>]*>/gi, '');

        // Normalize whitespace but preserve structure
        content = content.replace(/\r\n/g, '\n');
        content = content.trim();

        return content;
    }

    parseEvernoteDate(dateStr) {
        if (!dateStr) return new Date();
        
        // Evernote format: 20231015T120000Z
        const match = dateStr.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
        if (match) {
            const [, year, month, day, hour, minute, second] = match;
            return new Date(Date.UTC(
                parseInt(year), parseInt(month) - 1, parseInt(day),
                parseInt(hour), parseInt(minute), parseInt(second)
            ));
        }
        
        return new Date(dateStr);
    }

    async importAttachment(noteId, resource) {
        if (!resource.data || !resource.data._) {
            return; // No data to import
        }

        const filename = resource.filename || 
                        `attachment_${crypto.randomBytes(8).toString('hex')}`;
        const mimeType = resource.mime || 'application/octet-stream';
        const data = Buffer.from(resource.data._, 'base64');
        
        // Create uploads directory if needed
        const uploadsDir = path.join(__dirname, '../../uploads', String(this.userId));
        await fs.mkdir(uploadsDir, { recursive: true });
        
        // Save file
        const safeFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = path.join(uploadsDir, safeFilename);
        await fs.writeFile(filePath, data);

        // Record in database
        await this.db.query(
            `INSERT INTO attachments (note_id, filename, mime_type, size_bytes, storage_path)
             VALUES ($1, $2, $3, $4, $5)`,
            [noteId, filename, mimeType, data.length, `uploads/${this.userId}/${safeFilename}`]
        );
    }
}

module.exports = EvernoteImporter;
