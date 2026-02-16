import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators';

export default class Tag extends Model {
  static table = 'tags';
  static associations = {
    note_tags: { type: 'has_many', foreignKey: 'tag_id' },
  };

  @field('server_id') serverId;
  @field('name') name;
  @readonly @date('created_at') createdAt;

  @children('note_tags') noteTags;

  async getNotes() {
    const noteTags = await this.noteTags.fetch();
    const notes = await Promise.all(noteTags.map(nt => nt.note.fetch()));
    return notes.filter(n => !n.deletedAt);
  }
}
