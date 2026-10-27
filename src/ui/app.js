import { getPaklik, importPakliJSON, getEsedekesKartyak, updateKartya, getAllKartyak, resetPakliProgress } from '../db.js';
import { sm2 } from '../sm2.js';

// --- DOM Elemek ---
const viewDecks = document.getElementById('view-decks');
const viewStudy = document.getElementById('view-study');
const viewStats = document.getElementById('view-stats');
const deckList = document.getElementById('deck-list');
const importFile = document.getElementById('import-file');

// Tanulás nézet elemei
const studyTitle = document.getElementById('study-title');
const studyRemaining = document.getElementById('study-remaining');
const cardFront = document.getElementById('card-front');
const cardBack = document.getElementById('card-back');
const cardDivider = document.getElementById('card-divider');
const btnShow = document.getElementById('btn-show');
const evalControls = document.getElementById('eval-controls');

// --- Állapotváltozók a tanuláshoz ---
let aktivKartyak = [];
let jelenlegiIndex = 0;

// --- SPA Navigáció ---
function showView(viewName) {
  viewDecks.classList.add('hidden');
  viewStudy.classList.add('hidden');
  viewStats.classList.add('hidden');

  if (viewName === 'decks') {
    viewDecks.classList.remove('hidden');
    renderDecks();
  } else if (viewName === 'study') {
    viewStudy.classList.remove('hidden');
  } else if (viewName === 'stats') {
    viewStats.classList.remove('hidden');
    renderStats(); // <--- ITT HÍVJUK MEG A STATISZTIKÁT
  }
}

document.getElementById('nav-decks').addEventListener('click', () => showView('decks'));
document.getElementById('nav-stats').addEventListener('click', () => showView('stats'));
document.getElementById('btn-back-decks').addEventListener('click', () => {
  aktivKartyak = []; // Kilépéskor ürítjük
  showView('decks');
});

// --- Paklik kilistázása ---
async function renderDecks() {
  deckList.innerHTML = 'Betöltés...';
  try {
    const paklik = await getPaklik();
    if (paklik.length === 0) {
      deckList.innerHTML = '<p>Nincs még pakli. Importálj egyet alább!</p>';
      return;
    }
    deckList.innerHTML = '';
    paklik.forEach(pakli => {
      const div = document.createElement('div');
      div.className = 'deck-item';
      const title = document.createElement('strong');
      title.textContent = pakli.nev;
      
      const btnPlay = document.createElement('button');
      btnPlay.className = 'btn';
      btnPlay.textContent = 'Tanulás indítása';
      btnPlay.addEventListener('click', () => startStudy(pakli.id, pakli.nev));

      const btnReset = document.createElement('button');
      btnReset.className = 'btn';
      btnReset.textContent = 'Újrakezdés';
      btnReset.title = 'Kártyák visszaállítása a mai napra';
      btnReset.addEventListener('click', async () => {
        if (confirm(`Biztosan újra akarod kezdeni a(z) "${pakli.nev}" pakli tanulását?`)) {
          await resetPakliProgress(pakli.id);
          alert('A pakli sikeresen visszaállítva, újra esedékes minden kártya!');
          renderDecks();
        }
      });

      //Konkrét pakli Exportálása JSON-be
      const btnExport = document.createElement('button');
      btnExport.className = 'btn';
      btnExport.textContent = 'Exportálás';
      btnExport.title = 'Pakli letöltése JSON fájlként';
      btnExport.addEventListener('click', () => exportSingleDeck(pakli));

      const btnGroup = document.createElement('div');
      btnGroup.className = 'deck-btn-group';
      btnGroup.appendChild(btnPlay);
      btnGroup.appendChild(btnReset);
      btnGroup.appendChild(btnExport);

      div.appendChild(title);
      div.appendChild(btnGroup);
      deckList.appendChild(div);
    });
  } catch (err) {
    deckList.innerHTML = 'Hiba: ' + err.message;
  }
}

// --- TANULÁSI LOGIKA ÉS SM-2 ÖSSZEKÖTÉS ---
async function startStudy(pakliId, pakliNev) {
  studyTitle.textContent = `Tanulás: ${pakliNev}`;
  const ma = new Date().toISOString().slice(0, 10);
  
  try {
    aktivKartyak = await getEsedekesKartyak(pakliId, ma);
    
    if (aktivKartyak.length === 0) {
      alert('Erre a paklira mára végeztél, nincs esedékes kártya!');
      return;
    }

    jelenlegiIndex = 0;
    showView('study');
    renderCurrentCard();
  } catch (err) {
    alert('Hiba a kártyák betöltésekor: ' + err.message);
  }
}

function renderCurrentCard() {
  if (jelenlegiIndex >= aktivKartyak.length) {
    alert('Befejezted a mai adagot!');
    showView('decks');
    return;
  }

  const kartya = aktivKartyak[jelenlegiIndex];
  studyRemaining.textContent = aktivKartyak.length - jelenlegiIndex;
  
  cardFront.textContent = kartya.elolap;
  cardBack.textContent = kartya.hatlap;
  cardBack.classList.add('hidden');
  cardDivider.classList.add('hidden');
  
  btnShow.classList.remove('hidden');
  evalControls.classList.add('hidden');
}

function flipCard() {
  if (btnShow.classList.contains('hidden')) return; 

  cardBack.classList.remove('hidden');
  cardDivider.classList.remove('hidden');
  btnShow.classList.add('hidden');
  evalControls.classList.remove('hidden');
}

async function evaluateCard(q) {
  try {
    const kartya = aktivKartyak[jelenlegiIndex];
    if (!kartya) return;

    const ma = new Date().toISOString().slice(0, 10);
    
    // SM-2 algoritmus kiszámolja az új állapotot
    const ujErtekek = sm2(kartya, q, ma);
    
    // Frissítjük a kártya mezőit
    kartya.ef = ujErtekek.ef;
    kartya.intervallum = ujErtekek.intervallum;
    kartya.ismetles = ujErtekek.ismetles;
    kartya.kovetkezo = ujErtekek.kovetkezo;

    await updateKartya(kartya);

    jelenlegiIndex++;
    renderCurrentCard();
  } catch (err) {
    console.error('Hiba az értékelés mentésekor:', err);
    alert('Hiba történt a kártya mentésekor: ' + err.message);
  }
}

btnShow.addEventListener('click', flipCard);

document.querySelectorAll('#eval-controls .btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const q = parseInt(e.target.dataset.q, 10);
    evaluateCard(q);
  });
});

document.addEventListener('keydown', (e) => {
  if (viewStudy.classList.contains('hidden')) return;

  if (e.code === 'Space') {
    e.preventDefault(); 
    flipCard();
  }
  
  if (!evalControls.classList.contains('hidden')) {
    if (e.key === '1') evaluateCard(1); 
    if (e.key === '2') evaluateCard(3); 
    if (e.key === '3') evaluateCard(4); 
    if (e.key === '4') evaluateCard(5); 
  }
});

// --- JSON Importálás ---
importFile.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const jsonData = JSON.parse(e.target.result);
      await importPakliJSON(jsonData);
      alert('Sikeres importálás!');
      importFile.value = ''; 
      renderDecks(); 
    } catch (err) {
      alert('Hiba: ' + err.message);
    }
  };
  reader.readAsText(file);
});

// --- STATISZTIKA SZAMOLAS ES DIAGRAM  ---
async function renderStats() {
  const statDue = document.getElementById('stat-due');
  const statNew = document.getElementById('stat-new');
  const statLearned = document.getElementById('stat-learned');
  const forecastChart = document.getElementById('forecast-chart');

  if (!statDue || !forecastChart) return;

  try {
    const kartyak = await getAllKartyak();
    
    const ma = new Date();
    const ev = ma.getFullYear();
    const honap = String(ma.getMonth() + 1).padStart(2, '0');
    const nap = String(ma.getDate()).padStart(2, '0');
    const maStr = `${ev}-${honap}-${nap}`;

    let due = 0, uj = 0, tanult = 0;
    const forecast = new Array(30).fill(0); 

    kartyak.forEach(k => {
      // Új vs. tanult kártyák
      if (!k.ismetles || k.ismetles === 0) {
        uj++;
      } else {
        tanult++;
      }

      // Ma esedékes: ha még új, VAGY ha a következő dátuma mára vagy korábbra esik
      if ((!k.ismetles || k.ismetles === 0) || (k.kovetkezo && k.kovetkezo <= maStr)) {
        due++;
      }

      // 30 napos előrejelzés oszlopai
      if (k.kovetkezo) {
        const cardDate = new Date(k.kovetkezo + 'T00:00:00');
        const todayDate = new Date(maStr + 'T00:00:00');
        const diffDays = Math.round((cardDate - todayDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays < 30) {
          forecast[diffDays]++;
        }
      }
    });

    statDue.textContent = due;
    statNew.textContent = uj;
    statLearned.textContent = tanult;

    forecastChart.innerHTML = '';
    const maxVal = Math.max(...forecast, 1); 

    forecast.forEach((val, i) => {
      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      const heightPercent = (val / maxVal) * 100;
      bar.style.height = `${heightPercent}%`;
      
      const dateLabel = new Date(ma);
      dateLabel.setDate(ma.getDate() + i);
      const dateStr = dateLabel.toISOString().slice(5, 10);
      
      bar.title = `${dateStr}: ${val} kártya`; 
      forecastChart.appendChild(bar);
    });
  } catch (err) {
    console.error('Hiba a statisztika betöltésekor:', err);
  }
} 
// Indítás
showView('decks');

// --- Service Worker regisztráció ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker regisztrálva:', registration);
            })
            .catch(error => {
                console.error('Service Worker regisztrációs hiba:', error);
            });
    });
}

async function exportSingleDeck(pakli) {
  try {
    const allKartyak = await getAllKartyak(pakli.id);
    const exportData = {
      nev: pakli.nev,
      kartyak: allKartyak.map(k => ({
        elolap: k.elolap,
        hatlap: k.hatlap
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pakli.nev.replace(/[\s/\\?%*:|"<>]+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Hiba az exportálás során: ' + err.message);
  }
}