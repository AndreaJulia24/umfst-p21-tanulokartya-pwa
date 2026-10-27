const DB_NAME = 'StudyCardsDB';
const DB_VERSION = 1;

//adatbazis inicializálása, létrehozza a táblákat és indexeket
export function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Ez csak akkor fut le, ha még nem létezik az adatbázis, vagy nőtt a verziószám
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Paklik tábla
      if (!db.objectStoreNames.contains('paklik')) {
        db.createObjectStore('paklik', { keyPath: 'id', autoIncrement: true });
      }
      
      // Kártyák tábla
      if (!db.objectStoreNames.contains('kartyak')) {
        const kartyakStore = db.createObjectStore('kartyak', { keyPath: 'id', autoIncrement: true });
        // Indexek a gyors kereseshez (Tipp 2)
        kartyakStore.createIndex('pakliId', 'pakliId', { unique: false });
        kartyakStore.createIndex('kovetkezo', 'kovetkezo', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

//crud műveletek a paklikra 
//1. Pakli hozzáadása
export async function addPakli(nev) {
  const db = await initDatabase();

    return new Promise((resolve, reject) => {
    const tx = db.transaction('paklik', 'readwrite');
    const store = tx.objectStore('paklik');
    const request = store.add({ nev, letrehozva: new Date().toISOString() });
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

//2. Paklik lekérdezése ID alapján

export async function getPaklik() {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('paklik', 'readonly');
    const store = tx.objectStore('paklik');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

//3. uj kartya hozzáadása egy paklihoz

export async function addKartya(kartya) {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kartyak', 'readwrite');
    const store = tx.objectStore('kartyak');
    // Alapértelmezett SM-2 értékek beállítása, ha új a kártya
    if (!kartya.ef) {
      kartya.ef = 2.5;
      kartya.intervallum = 0;
      kartya.ismetles = 0;
      kartya.kovetkezo = new Date().toISOString().slice(0, 10);
    }
    const request = store.add(kartya);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

//kartya frissítése az adatbázisban uj SM-2 algoritmus ertekekkel

export async function updateKartya(kartya) {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kartyak', 'readwrite');
    const store = tx.objectStore('kartyak');
    const request = store.put(kartya);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// az uj vagy regebbi kártyák lekérdezése, amik esedékesek a mai napra vagy korábban
export async function getEsedekesKartyak(pakliId, maDatumString) {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kartyak', 'readonly');
    const store = tx.objectStore('kartyak');
    const index = store.index('kovetkezo');
    
    // IDBKeyRange.upperBound(ma) lekéri az összes kártyát, aminek a 'kovetkezo' dátuma <= mai dátum 
    const range = IDBKeyRange.upperBound(maDatumString);
    const request = index.getAll(range);
    
    request.onsuccess = () => {
      // Mivel a range csak dátumra szűr, memóriában szűrjük rá az adott paklira
      const kartyak = request.result.filter(k => k.pakliId === pakliId);
      resolve(kartyak);
    };
    request.onerror = () => reject(request.error);
  });
}

// 7. JSON Import (Tipp 4: validálás és egyetlen írási tranzakció)
export async function importPakliJSON(jsonData) {
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    // --- 1. SÉMA VALIDÁLÁS ---
    if (!jsonData || typeof jsonData !== 'object') {
      return reject(new Error('Érvénytelen JSON formátum.'));
    }
    if (!jsonData.nev || typeof jsonData.nev !== 'string') {
      return reject(new Error('Hiányzik a pakli neve.'));
    }
    if (!Array.isArray(jsonData.kartyak) || jsonData.kartyak.length === 0) {
      return reject(new Error('A kártyák listája hiányzik vagy üres.'));
    }
    
    // Kártyák formai ellenőrzése
    for (const k of jsonData.kartyak) {
      if (!k.elolap || !k.hatlap) {
        return reject(new Error('Minden kártyának kötelező előlappal és hátlappal rendelkeznie!'));
      }
    }

    // --- 2. MENTÉS EGYETLEN TRANZAKCIÓBAN ---
    // Mindkét táblát (paklik, kartyak) zároljuk írásra
    const tx = db.transaction(['paklik', 'kartyak'], 'readwrite');
    const pakliStore = tx.objectStore('paklik');
    const kartyakStore = tx.objectStore('kartyak');

    const pakliReq = pakliStore.add({ nev: jsonData.nev, letrehozva: new Date().toISOString() });
    
    pakliReq.onsuccess = () => {
      const ujPakliId = pakliReq.result; // Visszakapjuk a generált ID-t
      const ma = new Date().toISOString().slice(0, 10);
  
      jsonData.kartyak.forEach(k => {
        kartyakStore.add({
          pakliId: ujPakliId,
          elolap: k.elolap,
          hatlap: k.hatlap,
          ef: 2.5,
          intervallum: 0,
          ismetles: 0,
          kovetkezo: ma
        });
      });
    };

    // Ha a tranzakció minden eleme sikeres lefutott:
    tx.oncomplete = () => resolve('Sikeres import!');
    // Ha bármilyen hiba történik (pl. tárhely betelt), a rendszer automatikusan visszavonja (rollback) az egészet
    tx.onerror = () => reject(tx.error);
  });
}