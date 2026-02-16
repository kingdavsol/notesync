import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

export default class NoteTag extends Model {
  static table = 'note_tags';
  static associations = {
    notes: { type: 'belongs_to', key: 'note_id' },
    tags: { type: 'belongs_to', key: 'tag_id' },
  };

  @field('note_id') noteId;
  @field('tag_id') tagId;

  @relation('notes', 'note_id') note;
  @relation('tags', 'tag_id') tag;
}
