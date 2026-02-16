import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Folder extends Model {
  static table = 'folders';

  @field('server_id') serverId;
  @field('name') name;
  @field('parent_id') parentId;
  @readonly @date('created_at') createdAt;
  @date('updated_at') updatedAt;
}
