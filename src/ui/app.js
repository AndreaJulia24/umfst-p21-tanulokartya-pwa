import { getPaklik, importPakliJSON, getEsedekesKartyak, updateKartya } from '../db.js';
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
      
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = 'Tanulás indítása';
      btn.addEventListener('click', () => startStudy(pakli.id, pakli.nev));

      div.appendChild(title);
      div.appendChild(btn);
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
    // Csak a ma vagy régebben esedékes kártyákat kérjük le az index alapján!
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
  
  // Alapállapot: Csak az előlap látszik
  cardFront.textContent = kartya.elolap;
  cardBack.textContent = kartya.hatlap;
  cardBack.classList.add('hidden');
  cardDivider.classList.add('hidden');
  
  btnShow.classList.remove('hidden');
  evalControls.classList.add('hidden');
}

function flipCard() {
  // Ha már meg van fordítva, ne csináljon semmit
  if (btnShow.classList.contains('hidden')) return; 

  cardBack.classList.remove('hidden');
  cardDivider.classList.remove('hidden');
  btnShow.classList.add('hidden');
  evalControls.classList.remove('hidden');
}

async function evaluateCard(q) {
  const kartya = aktivKartyak[jelenlegiIndex];
  const ma = new Date().toISOString().slice(0, 10);
  
  // SM-2 algoritmus meghívása (importáltuk a fájl elején!)
  const ujErtekek = sm2(kartya, q, ma);
  
  // Frissítjük a kártya objektumot
  kartya.ef = ujErtekek.ef;
  kartya.intervallum = ujErtekek.intervallum;
  kartya.ismetles = ujErtekek.ismetles;
  
  // Kiszámoljuk a következő esedékesség dátumát
  const koviDatum = new Date();
  koviDatum.setDate(koviDatum.getDate() + ujErtekek.intervallum);
  kartya.kovetkezo = koviDatum.toISOString().slice(0, 10);

  // Mentés az IndexedDB-be
  await updateKartya(kartya);
  
  // Lépés a következő kártyára
  jelenlegiIndex++;
  renderCurrentCard();
}

// Gomb események a tanuláshoz
btnShow.addEventListener('click', flipCard);

document.querySelectorAll('#eval-controls .btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const q = parseInt(e.target.dataset.q, 10);
    evaluateCard(q);
  });
});

// Billentyűzet vezérlés (Space fordít, 1-4 értékel)
document.addEventListener('keydown', (e) => {
  // Csak akkor figyeljen, ha a tanulás nézetben vagyunk
  if (viewStudy.classList.contains('hidden')) return;

  if (e.code === 'Space') {
    e.preventDefault(); // Ne görgessen le a szóköz
    flipCard();
  }
  
  // Ha az értékelő gombok látszanak, engedjük a számgombokat
  if (!evalControls.classList.contains('hidden')) {
    if (e.key === '1') evaluateCard(1); // Újra
    if (e.key === '2') evaluateCard(3); // Nehéz
    if (e.key === '3') evaluateCard(4); // Jó
    if (e.key === '4') evaluateCard(5); // Könnyű
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

// Indítás
showView('decks');

// --- Service Worker regisztráció ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker regisztrálva:', registration);
            })
            .catch(error => {
                console.error('Service Worker regisztrációs hiba:', error);
            });
    });
}