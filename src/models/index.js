import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema from './schema';
import Note from './Note';
import Folder from './Folder';
import Tag from './Tag';
import NoteTag from './NoteTag';
import SyncQueue from './SyncQueue';
import AppState from './AppState';

const adapter = new SQLiteAdapter({
  schema,
  // (You might want to comment out migrations for development)
  // migrations,
  jsi: true, // Use JSI for better performance
  onSetUpError: error => {
    console.error('Database setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Note, Folder, Tag, NoteTag, SyncQueue, AppState],
});

export { Note, Folder, Tag, NoteTag, SyncQueue, AppState };
