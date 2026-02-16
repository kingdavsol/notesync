import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class SyncQueue extends Model {
  static table = 'sync_queue';

  @field('entity_type') entityType; // 'note' | 'folder'
  @field('entity_id') entityId;
  @field('action') action; // 'create' | 'update' | 'delete'
  @date('timestamp') timestamp;
}
