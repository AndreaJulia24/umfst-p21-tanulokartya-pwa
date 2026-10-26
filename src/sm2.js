// src/sm2.js – tiszta függvény
// kartya: { ef: 2.5, intervallum: 0, ismetles: 0 }, q: 0..5 (válasz minősége)
export function sm2(kartya, q, ma = new Date()) {
  let ef = kartya.ef ?? 2.5;
  let intervallum = kartya.intervallum ?? 0;
  let ismetles = kartya.ismetles ?? 0;

  if (q < 3) {
    ismetles = 0;
    intervallum = 1;
  } else {
    if (ismetles === 0) {
      intervallum = 1;
    } else if (ismetles === 1) {
      intervallum = 6;
    } else {
      intervallum = Math.round(intervallum * ef);
    }
    ismetles += 1;
  }

  // EF módosítása a standard képlet alapján:
  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  
  // Alsó korlát ellenőrzése: minimum 1.3
  if (ef < 1.3) {
    ef = 1.3;
  }

  // 2 tizedesjegyre kerekítés a lebegőpontos hibák elkerülésére
  ef = Math.round(ef * 100) / 100;

  // Következő esedékesség dátumának kiszámítása (YYYY-MM-DD formátumban)
  const kovetkezo = new Date(ma);
  kovetkezo.setDate(kovetkezo.getDate() + intervallum);
  const kovetkezoDatum = kovetkezo.toISOString().slice(0, 10);

  return {
    ef,
    intervallum,
    ismetles,
    kovetkezo: kovetkezoDatum
  };
}