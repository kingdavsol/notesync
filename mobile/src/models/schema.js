import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'notes',
      columns: [
        { name: 'server_id', type: 'number', isOptional: true, isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'content_plain', type: 'string' },
        { name: 'folder_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'offline_enabled', type: 'boolean' },
        { name: 'is_pinned', type: 'boolean' },
        { name: 'sync_status', type: 'string', isIndexed: true }, // 'synced' | 'pending' | 'conflict'
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
        { name: 'base_updated_at', type: 'number', isOptional: true }, // for conflict detection
      ],
    }),
    tableSchema({
      name: 'folders',
      columns: [
        { name: 'server_id', type: 'number', isOptional: true, isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'parent_id', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'tags',
      columns: [
        { name: 'server_id', type: 'number', isOptional: true, isIndexed: true },
        { name: 'name', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'note_tags',
      columns: [
        { name: 'note_id', type: 'string', isIndexed: true },
        { name: 'tag_id', type: 'string', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'entity_type', type: 'string' }, // 'note' | 'folder'
        { name: 'entity_id', type: 'string' },
        { name: 'action', type: 'string' }, // 'create' | 'update' | 'delete'
        { name: 'timestamp', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'app_state',
      columns: [
        { name: 'key', type: 'string', isIndexed: true },
        { name: 'value', type: 'string' }, // JSON serialized
      ],
    }),
  ],
});
