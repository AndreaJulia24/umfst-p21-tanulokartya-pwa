import { describe, it, expect } from 'vitest';
import { sm2 } from './sm2.js';

describe('SM-2 algoritmus tesztek', () => {
  const alapDatum = new Date('2026-10-26T12:00:00Z');

  it('1. Első sikeres tanulás (q=4): ismétlés=1, intervallum=1 nap', () => {
    const ujKartya = { ef: 2.5, intervallum: 0, ismetles: 0 };
    const eredmeny = sm2(ujKartya, 4, alapDatum);

    expect(eredmeny.ismetles).toBe(1);
    expect(eredmeny.intervallum).toBe(1);
    expect(eredmeny.ef).toBe(2.5); // q=4 esetén az EF nem változik
    expect(eredmeny.kovetkezo).toBe('2026-10-27');
  });

  it('2. Második sikeres tanulás (q=4): ismétlés=2, intervallum=6 nap', () => {
    const elsoKor = { ef: 2.5, intervallum: 1, ismetles: 1 };
    const eredmeny = sm2(elsoKor, 4, alapDatum);

    expect(eredmeny.ismetles).toBe(2);
    expect(eredmeny.intervallum).toBe(6);
    expect(eredmeny.kovetkezo).toBe('2026-11-01');
  });

  it('3. Harmadik sikeres tanulás (q=4): intervallum = 6 * 2.5 = 15 nap', () => {
    const masodikKor = { ef: 2.5, intervallum: 6, ismetles: 2 };
    const eredmeny = sm2(masodikKor, 4, alapDatum);

    expect(eredmeny.ismetles).toBe(3);
    expect(eredmeny.intervallum).toBe(15);
    expect(eredmeny.kovetkezo).toBe('2026-11-10');
  });

  it('4. Sikertelen válasz (q=1, Újra): intervallum visszaáll 1 napra, ismétlés=0', () => {
    const haladoKartya = { ef: 2.5, intervallum: 15, ismetles: 3 };
    const eredmeny = sm2(haladoKartya, 1, alapDatum);

    expect(eredmeny.ismetles).toBe(0);
    expect(eredmeny.intervallum).toBe(1);
    expect(eredmeny.kovetkezo).toBe('2026-10-27');
  });

  it('5. Maximális válaszminőség (q=5): az EF növekszik (+0.1)', () => {
    const kartya = { ef: 2.5, intervallum: 0, ismetles: 0 };
    const eredmeny = sm2(kartya, 5, alapDatum);

    expect(eredmeny.ef).toBe(2.6);
  });

  it('6. Határérték válasz (q=3): az EF csökken (-0.14)', () => {
    const kartya = { ef: 2.5, intervallum: 0, ismetles: 0 };
    const eredmeny = sm2(kartya, 3, alapDatum);

    expect(eredmeny.ef).toBe(2.36);
  });

  it('7. Alsó korlát garancia: az EF soha nem csökken 1.3 alá', () => {
    const marAlacsony = { ef: 1.35, intervallum: 1, ismetles: 1 };
    const eredmeny = sm2(marAlacsony, 0, alapDatum);

    expect(eredmeny.ef).toBe(1.3);
  });

  it('8. Alapértelmezett értékek kezelése (ha hiányoznak a mezők)', () => {
    const hianyosKartya = {};
    const eredmeny = sm2(hianyosKartya, 4, alapDatum);

    expect(eredmeny.ef).toBe(2.5);
    expect(eredmeny.intervallum).toBe(1);
    expect(eredmeny.ismetles).toBe(1);
  });
});