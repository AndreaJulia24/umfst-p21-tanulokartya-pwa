# Vizsgafelkészítő tanulókártya PWA

Ez a projekt egy offline is működő, telepíthető webalkalmazás (PWA), amely a térközös ismétlés (spaced repetition) módszerével, az SM-2 algoritmus segítségével ütemezi a tanulókártyákat. Kifejezetten orvostanhallgatók (és más egyetemisták) számára készült a hatékony vizsgafelkészüléshez.

## Az SM-2 algoritmus működése

Az SM-2 (SuperMemo-2) algoritmus célja, hogy a tanulókártyákat pontosan akkor adja fel újra, amikor épp elfelejtenénk őket. Minden kártyához egy **könnyűségi tényezőt (Easiness Factor - EF)**, egy **intervallumot** (napokban) és egy **ismétlésszámot** rendel.

A felhasználó a kártya hátlapjának megtekintése után 0-tól 5-ig terjedő skálán (q) értékeli, mennyire emlékezett a válaszra:
*   **Sikertelen válasz (q < 3):** A kártya visszaugrik a tanulási fázis elejére. Az ismétlésszám nullázódik, az intervallum 1 napra áll vissza.
*   **Sikeres válasz (q >= 3):** Az intervallum növekszik. Az 1. sikeres ismétlés után 1 nap, a 2. után 6 nap lesz. A 3. ismétléstől kezdve a korábbi intervallumot megszorozzuk az EF-fel.
*   **EF frissítése:** A válasz minőségétől függően az EF nő (ha könnyű volt) vagy csökken (ha nehéz). Az EF alsó határa 1.3, alá sosem csökkenhet.

### Kézzel számolt példa

Tegyük fel, hogy van egy új kártyánk: `EF = 2.5`, `intervallum = 0`, `ismétlés = 0`.

**1. Nap (Első tanulás):**
*   A felhasználó válasza: `q = 4` (Jó).
*   Mivel ez az 1. ismétlés, az `intervallum = 1` nap lesz, az `ismétlés` száma 1-re nő.
*   EF számítás: $EF = 2.5 + (0.1 - (5 - 4) \cdot (0.08 + (5 - 4) \cdot 0.02)) = 2.5 + (0.1 - 1 \cdot 0.1) = 2.5$
*   Eredmény: A kártyát holnap (1 nap múlva) újra feladja a rendszer, EF = 2.5.

**2. Nap (Második tanulás):**
*   A felhasználó válasza: `q = 3` (Nehéz).
*   Mivel ez a 2. ismétlés, a szabály szerint az `intervallum = 6` nap lesz, az `ismétlés` száma 2-re nő.
*   EF számítás: $EF = 2.5 + (0.1 - (5 - 3) \cdot (0.08 + (5 - 3) \cdot 0.02)) = 2.5 + (0.1 - 2 \cdot 0.12) = 2.5 - 0.14 = 2.36$
*   Eredmény: A kártyát 6 nap múlva adja fel újra, az EF pedig 2.36-ra csökkent, mert nehezebbnek bizonyult.

**3. Tanulási alkalom (6 nappal később):**
*   A felhasználó válasza: `q = 1` (Újra - teljesen elfelejtette).
*   Mivel a válasz sikertelen (q < 3), a büntetés azonnali: az `intervallum = 1` napra áll vissza, az `ismétlés` száma pedig nullázódik (0).
*   EF számítás: $EF = 2.36 + (0.1 - (5 - 1) \cdot (0.08 + (5 - 1) \cdot 0.02)) = 2.36 + (0.1 - 4 \cdot 0.16) = 2.36 - 0.54 = 1.82$
*   Eredmény: A kártyát másnap újra feladja a rendszer (hogy újra rögzüljön), az EF pedig meredeken, 1.82-re zuhant.

## IndexedDB Séma

Az alkalmazás az adatokat a böngésző helyi `IndexedDB` adatbázisában tárolja (`StudyCardsDB`).

### 1. Object Store: `paklik`
A kártyacsomagok (paklik) metaadatait tárolja.
*   **Key Path:** `id` (Auto-increment)
*   **Mezők:** `nev` (A pakli neve, pl. "Anatómia"), `letrehozva` (Dátum).

### 2. Object Store: `kartyak`
A paklikhoz tartozó konkrét tanulókártyákat és azok SM-2 állapotát tárolja.
*   **Key Path:** `id` (Auto-increment)
*   **Mezők:** `pakliId`, `elolap`, `hatlap`, `ef`, `intervallum`, `ismetles`, `kovetkezo` (Dátum string, pl. "2026-10-26").
*   **Indexek:**
    *   `pakliId`: Gyors lekérdezés egy adott pakli összes kártyájának betöltéséhez.
    *   `kovetkezo`: A dátummező indexelése elengedhetetlen a ma esedékes kártyák 50 ms alatti lekérdezéséhez (IDBKeyRange használatával).