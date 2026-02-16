import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class AppState extends Model {
  static table = 'app_state';

  @field('key') key;
  @field('value') value; // JSON serialized

  static async getValue(database, key, defaultValue = null) {
    const records = await database.collections
      .get('app_state')
      .query(Q.where('key', key))
      .fetch();

    if (records.length === 0) return defaultValue;

    try {
      return JSON.parse(records[0].value);
    } catch (err) {
      return defaultValue;
    }
  }

  static async setValue(database, key, value) {
    await database.write(async () => {
      const records = await database.collections
        .get('app_state')
        .query(Q.where('key', key))
        .fetch();

      const jsonValue = JSON.stringify(value);

      if (records.length > 0) {
        await records[0].update(record => {
          record.value = jsonValue;
        });
      } else {
        await database.collections.get('app_state').create(record => {
          record.key = key;
          record.value = jsonValue;
        });
      }
    });
  }
}
