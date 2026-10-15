import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export interface BookmarkItem {
  title: string;
  url: string;
}

const COMMON_BOOKMARKS: BookmarkItem[] = [
  { title: 'Checar Navegador', url: 'https://www.browserscan.net/' },
];

const PLATFORM_BOOKMARKS: Record<string, BookmarkItem[]> = {
  facebook: [
    { title: 'Meta Ads Manager', url: 'https://adsmanager.facebook.com/' },
    { title: 'Meta Business Suite', url: 'https://business.facebook.com/' },
    { title: 'Facebook', url: 'https://facebook.com' },
    { title: 'Instagram', url: 'https://instagram.com' },
  ],
  google: [
    { title: 'Google Ads', url: 'https://ads.google.com/' },
    { title: 'Google', url: 'https://google.com' },
  ],
  tiktok: [
    { title: 'TikTok Ads', url: 'https://ads.tiktok.com/' },
    { title: 'TikTok', url: 'https://www.tiktok.com' },
  ],
  amazon: [
    { title: 'Amazon', url: 'https://www.amazon.com' },
  ],
  chrome: [
    { title: 'Google', url: 'https://google.com' },
  ],
  general: [
    { title: 'Google', url: 'https://google.com' },
  ],
};

function getReverseHost(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    const hostParts = u.hostname.split('.');
    return hostParts.reverse().join('.') + '.';
  } catch {
    return 'moc.elgoog.';
  }
}

function generateRandomGuid(len = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
  let res = '';
  for (let i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

const BASE_PLACES_DDL = `
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS moz_origins ( id INTEGER PRIMARY KEY, prefix TEXT NOT NULL, host TEXT NOT NULL, frecency INTEGER NOT NULL, recalc_frecency INTEGER NOT NULL DEFAULT 0, alt_frecency INTEGER, recalc_alt_frecency INTEGER NOT NULL DEFAULT 0, block_until_ms INTEGER, block_pages_until_ms INTEGER, UNIQUE (prefix, host) );
CREATE TABLE IF NOT EXISTS moz_places ( id INTEGER PRIMARY KEY, url LONGVARCHAR, title LONGVARCHAR, rev_host LONGVARCHAR, visit_count INTEGER DEFAULT 0, hidden INTEGER DEFAULT 0 NOT NULL, typed INTEGER DEFAULT 0 NOT NULL, frecency INTEGER DEFAULT -1 NOT NULL, last_visit_date INTEGER, guid TEXT, foreign_count INTEGER DEFAULT 0 NOT NULL, url_hash INTEGER DEFAULT 0 NOT NULL, description TEXT, preview_image_url TEXT, site_name TEXT, origin_id INTEGER REFERENCES moz_origins(id), recalc_frecency INTEGER NOT NULL DEFAULT 0, alt_frecency INTEGER, recalc_alt_frecency INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS moz_places_extra ( place_id INTEGER PRIMARY KEY NOT NULL, sync_json TEXT, FOREIGN KEY (place_id) REFERENCES moz_places(id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS moz_historyvisits ( id INTEGER PRIMARY KEY, from_visit INTEGER, place_id INTEGER, visit_date INTEGER, visit_type INTEGER, session INTEGER, source INTEGER DEFAULT 0 NOT NULL, triggeringPlaceId INTEGER);
CREATE TABLE IF NOT EXISTS moz_historyvisits_extra ( visit_id INTEGER PRIMARY KEY NOT NULL, sync_json TEXT, FOREIGN KEY (visit_id) REFERENCES moz_historyvisits(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS moz_inputhistory ( place_id INTEGER NOT NULL, input LONGVARCHAR NOT NULL, use_count INTEGER, PRIMARY KEY (place_id, input));
CREATE TABLE IF NOT EXISTS moz_bookmarks ( id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER DEFAULT NULL, parent INTEGER, position INTEGER, title LONGVARCHAR, keyword_id INTEGER, folder_type TEXT, dateAdded INTEGER, lastModified INTEGER, guid TEXT, syncStatus INTEGER NOT NULL DEFAULT 0, syncChangeCounter INTEGER NOT NULL DEFAULT 1);
INSERT OR IGNORE INTO moz_bookmarks VALUES(1,2,NULL,0,0,'',NULL,NULL,1791740061550000,1791740061550000,'root________',1,1);
INSERT OR IGNORE INTO moz_bookmarks VALUES(2,2,NULL,1,0,'menu',NULL,NULL,1791740061550000,1791740061550000,'menu________',1,1);
INSERT OR IGNORE INTO moz_bookmarks VALUES(3,2,NULL,1,1,'toolbar',NULL,NULL,1791740061550000,1791740061550000,'toolbar_____',1,1);
INSERT OR IGNORE INTO moz_bookmarks VALUES(4,2,NULL,1,2,'tags',NULL,NULL,1791740061550000,1791740061550000,'tags________',1,1);
INSERT OR IGNORE INTO moz_bookmarks VALUES(5,2,NULL,1,3,'unfiled',NULL,NULL,1791740061550000,1791740061550000,'unfiled_____',1,1);
INSERT OR IGNORE INTO moz_bookmarks VALUES(6,2,NULL,1,4,'mobile',NULL,NULL,1791740061575000,1791740061575000,'mobile______',1,1);
CREATE TABLE IF NOT EXISTS moz_bookmarks_deleted ( guid TEXT PRIMARY KEY, dateRemoved INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS moz_keywords ( id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT UNIQUE, place_id INTEGER, post_data TEXT);
CREATE TABLE IF NOT EXISTS moz_anno_attributes ( id INTEGER PRIMARY KEY, name VARCHAR(32) UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS moz_annos ( id INTEGER PRIMARY KEY, place_id INTEGER NOT NULL, anno_attribute_id INTEGER, content LONGVARCHAR, flags INTEGER DEFAULT 0, expiration INTEGER DEFAULT 0, type INTEGER DEFAULT 0, dateAdded INTEGER DEFAULT 0, lastModified INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS moz_items_annos ( id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL, anno_attribute_id INTEGER, content LONGVARCHAR, flags INTEGER DEFAULT 0, expiration INTEGER DEFAULT 0, type INTEGER DEFAULT 0, dateAdded INTEGER DEFAULT 0, lastModified INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS moz_meta (key TEXT PRIMARY KEY, value NOT NULL) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS moz_places_metadata (id INTEGER PRIMARY KEY, place_id INTEGER NOT NULL, referrer_place_id INTEGER, created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0, total_view_time INTEGER NOT NULL DEFAULT 0, typing_time INTEGER NOT NULL DEFAULT 0, key_presses INTEGER NOT NULL DEFAULT 0, scrolling_time INTEGER NOT NULL DEFAULT 0, scrolling_distance INTEGER NOT NULL DEFAULT 0, document_type INTEGER NOT NULL DEFAULT 0, search_query_id INTEGER, FOREIGN KEY (place_id) REFERENCES moz_places(id) ON DELETE CASCADE, FOREIGN KEY (referrer_place_id) REFERENCES moz_places(id) ON DELETE CASCADE, FOREIGN KEY(search_query_id) REFERENCES moz_places_metadata_search_queries(id) ON DELETE CASCADE CHECK(place_id != referrer_place_id) );
CREATE TABLE IF NOT EXISTS moz_places_metadata_search_queries ( id INTEGER PRIMARY KEY, terms TEXT NOT NULL UNIQUE );
CREATE TABLE IF NOT EXISTS moz_previews_tombstones ( hash TEXT PRIMARY KEY ) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS moz_newtab_story_click ( feature TEXT NOT NULL, timestamp_s INTEGER NOT NULL, card_format_enum INTEGER NOT NULL, position INTEGER NOT NULL, section_position INTEGER NOT NULL, feature_value REAL NOT NULL DEFAULT 1 );
CREATE TABLE IF NOT EXISTS moz_newtab_story_impression ( feature TEXT NOT NULL, timestamp_s INTEGER NOT NULL, card_format_enum INTEGER NOT NULL, position INTEGER NOT NULL, section_position INTEGER NOT NULL, feature_value REAL NOT NULL DEFAULT 1 );
CREATE TABLE IF NOT EXISTS moz_newtab_shortcuts_interaction ( id INTEGER PRIMARY KEY, place_id INTEGER NOT NULL REFERENCES moz_places(id) ON DELETE CASCADE, event_type INTEGER NOT NULL, timestamp_s INTEGER NOT NULL, pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)), tile_position INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS moz_places_url_hashindex ON moz_places (url_hash);
CREATE INDEX IF NOT EXISTS moz_places_hostindex ON moz_places (rev_host);
CREATE INDEX IF NOT EXISTS moz_places_visitcount ON moz_places (visit_count);
CREATE INDEX IF NOT EXISTS moz_places_frecencyindex ON moz_places (frecency);
CREATE INDEX IF NOT EXISTS moz_places_lastvisitdateindex ON moz_places (last_visit_date);
CREATE UNIQUE INDEX IF NOT EXISTS moz_places_guid_uniqueindex ON moz_places (guid);
CREATE INDEX IF NOT EXISTS moz_places_originidindex ON moz_places (origin_id);
CREATE INDEX IF NOT EXISTS moz_places_altfrecencyindex ON moz_places (alt_frecency);
CREATE INDEX IF NOT EXISTS moz_historyvisits_placedateindex ON moz_historyvisits (place_id, visit_date);
CREATE INDEX IF NOT EXISTS moz_historyvisits_fromindex ON moz_historyvisits (from_visit);
CREATE INDEX IF NOT EXISTS moz_historyvisits_dateindex ON moz_historyvisits (visit_date);
CREATE INDEX IF NOT EXISTS moz_bookmarks_itemindex ON moz_bookmarks (fk, type);
CREATE INDEX IF NOT EXISTS moz_bookmarks_parentindex ON moz_bookmarks (parent, position);
CREATE INDEX IF NOT EXISTS moz_bookmarks_itemlastmodifiedindex ON moz_bookmarks (fk, lastModified);
CREATE INDEX IF NOT EXISTS moz_bookmarks_dateaddedindex ON moz_bookmarks (dateAdded);
CREATE UNIQUE INDEX IF NOT EXISTS moz_bookmarks_guid_uniqueindex ON moz_bookmarks (guid);
CREATE UNIQUE INDEX IF NOT EXISTS moz_keywords_placepostdata_uniqueindex ON moz_keywords (place_id, post_data);
CREATE UNIQUE INDEX IF NOT EXISTS moz_annos_placeattributeindex ON moz_annos (place_id, anno_attribute_id);
CREATE UNIQUE INDEX IF NOT EXISTS moz_items_annos_itemattributeindex ON moz_items_annos (item_id, anno_attribute_id);
CREATE UNIQUE INDEX IF NOT EXISTS moz_places_metadata_placecreated_uniqueindex ON moz_places_metadata (place_id, created_at);
CREATE INDEX IF NOT EXISTS moz_places_metadata_referrerindex ON moz_places_metadata (referrer_place_id);
COMMIT;
PRAGMA user_version = 86;
`;

export class ProfileBookmarkSeeder {
  /**
   * Seeds bookmarks, toolbars and window preferences in the profile folder.
   * Executed strictly ONLY ONCE per profile to prevent duplicates and respect user edits.
   */
  static seedBookmarks(profileDir: string, platform = 'general'): void {
    try {
      if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
      }

      const markerPath = path.join(profileDir, '.bookmarks_seeded');

      // 1. Se já foi inicializado anteriormente, NUNCA mais insere ou altera favoritos
      if (fs.existsSync(markerPath)) {
        return;
      }

      const dbPath = path.join(profileDir, 'places.sqlite');

      // 2. Se o banco places.sqlite já existe (perfil criado/aberto antes deste marcador),
      // normaliza duplicatas acumuladas, injeta COMMON_BOOKMARKS se ausente e marca como semeado.
      if (fs.existsSync(dbPath)) {
        try {
          const nowUs = Date.now() * 1000;
          let sql = 'BEGIN TRANSACTION;\n';

          // Garante que o favorito comum (Checar Navegador) exista caso ainda não esteja presente
          COMMON_BOOKMARKS.forEach((bm) => {
            const revHost = getReverseHost(bm.url);
            const placeGuid = generateRandomGuid();
            const bmGuid = generateRandomGuid();
            const safeTitle = bm.title.replace(/'/g, "''");
            const safeUrl = bm.url.replace(/'/g, "''");

            sql += `
              INSERT INTO moz_places (url, title, rev_host, foreign_count, guid)
              SELECT '${safeUrl}', '${safeTitle}', '${revHost}', 1, '${placeGuid}'
              WHERE NOT EXISTS (SELECT 1 FROM moz_places WHERE url = '${safeUrl}');

              INSERT INTO moz_bookmarks (type, fk, parent, position, title, dateAdded, lastModified, guid)
              SELECT 1, p.id, 3, COALESCE((SELECT MAX(position) + 1 FROM moz_bookmarks WHERE parent = 3), 0), '${safeTitle}', ${nowUs}, ${nowUs}, '${bmGuid}'
              FROM moz_places p
              WHERE p.url = '${safeUrl}'
                AND NOT EXISTS (
                  SELECT 1 FROM moz_bookmarks b WHERE b.parent = 3 AND (b.fk = p.id OR b.title = '${safeTitle}')
                )
              LIMIT 1;
            `;
          });

          // Limpa possíveis duplicatas acumuladas em parent = 3 (Toolbar)
          sql += `
            DELETE FROM moz_bookmarks 
            WHERE parent = 3 
              AND id NOT IN (
                SELECT MIN(id) FROM moz_bookmarks WHERE parent = 3 GROUP BY title
              );

            WITH numbered AS (
              SELECT id, ROW_NUMBER() OVER (ORDER BY position, id) - 1 AS new_pos
              FROM moz_bookmarks
              WHERE parent = 3
            )
            UPDATE moz_bookmarks
            SET position = (SELECT new_pos FROM numbered WHERE numbered.id = moz_bookmarks.id)
            WHERE parent = 3;
            COMMIT;
          `;
          execFileSync('sqlite3', [dbPath, sql]);
        } catch (e: any) {
          console.warn('[ProfileBookmarkSeeder] Falha ao normalizar favoritos existentes:', e?.message || e);
        }

        try {
          fs.writeFileSync(markerPath, JSON.stringify({ seededAt: Date.now(), platform }), 'utf-8');
        } catch {}
        return;
      }

      // 3. Novo perfil: inicializa places.sqlite e insere os favoritos UMA ÚNICA VEZ
      const platformKey = (platform || 'general').toLowerCase();
      const baseBookmarks = PLATFORM_BOOKMARKS[platformKey] || PLATFORM_BOOKMARKS.general;
      const bookmarks = [...baseBookmarks, ...COMMON_BOOKMARKS];

      try {
        execFileSync('sqlite3', [dbPath, BASE_PLACES_DDL]);
      } catch (e: any) {
        console.warn('[ProfileBookmarkSeeder] Falha ao inicializar DDL do places.sqlite:', e?.message || e);
      }

      if (fs.existsSync(dbPath) && bookmarks.length > 0) {
        try {
          const nowUs = Date.now() * 1000;
          let sql = 'BEGIN TRANSACTION;\n';

          bookmarks.forEach((bm, idx) => {
            const revHost = getReverseHost(bm.url);
            const placeGuid = generateRandomGuid();
            const bmGuid = generateRandomGuid();
            const safeTitle = bm.title.replace(/'/g, "''");
            const safeUrl = bm.url.replace(/'/g, "''");

            sql += `
              INSERT INTO moz_places (url, title, rev_host, foreign_count, guid)
              SELECT '${safeUrl}', '${safeTitle}', '${revHost}', 1, '${placeGuid}'
              WHERE NOT EXISTS (SELECT 1 FROM moz_places WHERE url = '${safeUrl}');

              INSERT INTO moz_bookmarks (type, fk, parent, position, title, dateAdded, lastModified, guid)
              SELECT 1, p.id, 3, ${idx}, '${safeTitle}', ${nowUs}, ${nowUs}, '${bmGuid}'
              FROM moz_places p
              WHERE p.url = '${safeUrl}'
              LIMIT 1;
            `;
          });

          sql += 'COMMIT;\n';
          execFileSync('sqlite3', [dbPath, sql]);
          console.log(`[ProfileBookmarkSeeder] ${bookmarks.length} favoritos configurados inicialmente para plataforma "${platform}".`);
        } catch (e: any) {
          console.warn('[ProfileBookmarkSeeder] Erro ao injetar favoritos:', e?.message || e);
        }
      }

      // 4. Configure xulstore.json so PersonalToolbar (Bookmarks Toolbar) starts visible
      try {
        const xulStorePath = path.join(profileDir, 'xulstore.json');
        let xulData: any = {};
        if (fs.existsSync(xulStorePath)) {
          try {
            xulData = JSON.parse(fs.readFileSync(xulStorePath, 'utf-8'));
          } catch {}
        }
        if (!xulData['chrome://browser/content/browser.xhtml']) {
          xulData['chrome://browser/content/browser.xhtml'] = {};
        }
        xulData['chrome://browser/content/browser.xhtml']['PersonalToolbar'] = { collapsed: 'false' };
        fs.writeFileSync(xulStorePath, JSON.stringify(xulData, null, 2), 'utf-8');
      } catch {}

      // 5. Ensure prefs.js has bookmarks toolbar visibility and title modifier
      try {
        const prefsPath = path.join(profileDir, 'prefs.js');
        let existingPrefs = fs.existsSync(prefsPath) ? fs.readFileSync(prefsPath, 'utf-8') : '';
        const prefsToAdd = [
          'user_pref("browser.toolbars.bookmarks.visibility", "always");',
          'user_pref("browser.windows.titlemodifier", "Geenjutsu");',
          'user_pref("browser.windows.titlemodifier.pinned", "Geenjutsu");',
          'user_pref("browser.windows.titlemodifier.container", "Geenjutsu");',
        ];

        let modified = false;
        for (const pref of prefsToAdd) {
          const prefKey = pref.split(',')[0];
          if (!existingPrefs.includes(prefKey)) {
            existingPrefs += `\n${pref}`;
            modified = true;
          }
        }

        if (modified) {
          fs.writeFileSync(prefsPath, existingPrefs.trim() + '\n', 'utf-8');
        }
      } catch {}

      // 6. Grava marcador permanente: favoritos foram semeados com sucesso e nunca mais devem ser tocados
      try {
        fs.writeFileSync(markerPath, JSON.stringify({ seededAt: Date.now(), platform }), 'utf-8');
      } catch {}
    } catch (err: any) {
      console.warn('[ProfileBookmarkSeeder] Erro geral ao configurar favoritos:', err?.message || err);
    }
  }
}
