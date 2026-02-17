import { Model } from '@nozbe/watermelondb';
import { field, date, children, relation } from '@nozbe/watermelondb/decorators';

export default class Note extends Model {
  static table = 'notes';
  static associations = {
    folders: { type: 'belongs_to', key: 'folder_id' },
    note_tags: { type: 'has_many', foreignKey: 'note_id' },
  };

  @field('server_id') serverId;
  @field('title') title;
  @field('content') content;
  @field('content_plain') contentPlain;
  @field('folder_id') folderId;
  @field('offline_enabled') offlineEnabled;
  @field('is_pinned') isPinned;
  @field('sync_status') syncStatus; // 'synced' | 'pending' | 'conflict'
  @date('created_at') createdAt;
  @date('updated_at') updatedAt;
  @date('deleted_at') deletedAt;
  @date('base_updated_at') baseUpdatedAt;

  @children('note_tags') noteTags;
  @relation('folders', 'folder_id') folder;

  // Helper methods
  async getTags() {
    const noteTags = await this.noteTags.fetch();
    const tags = await Promise.all(noteTags.map(nt => nt.tag.fetch()));
    return tags;
  }

  async markForSync() {
    await this.update(note => {
      note.syncStatus = 'pending';
      note.updatedAt = new Date();
    });
  }

  async softDelete() {
    await this.update(note => {
      note.deletedAt = new Date();
      note.syncStatus = 'pending';
    });
  }

  get isDeleted() {
    return !!this.deletedAt;
  }

  get needsSync() {
    return this.syncStatus === 'pending';
  }

  get hasConflict() {
    return this.syncStatus === 'conflict';
  }
}
