import { describe, expect, it } from 'vitest';
import { zodiacAnimal, zodiacEmoji } from '../zodiac';

const z = (birthYear?: number, birthMonth?: number, birthDay?: number) =>
  zodiacAnimal({ birthYear, birthMonth, birthDay }, 'zh');

describe('zodiacAnimal', () => {
  it('needs a birth year', () => {
    expect(z()).toBe(null);
  });

  it('takes the year alone as the lunar year', () => {
    expect(z(1893)).toBe('蛇');
    expect(z(1984)).toBe('鼠');
    expect(z(1715)).toBe('羊');
  });

  it('switches at 春节 for a full date', () => {
    // 春节 1898 fell on 22 January
    expect(z(1898, 1, 21)).toBe('鸡');
    expect(z(1898, 1, 22)).toBe('狗');
    expect(z(1893, 12, 26)).toBe('蛇');
  });

  it('settles January or February without a day only when 春节 falls outside the month', () => {
    // 春节 1898: 22 January; 1900: 31 January; 1901: 19 February
    expect(z(1898, 1)).toBe(null);
    expect(z(1898, 2)).toBe('狗');
    expect(z(1901, 1)).toBe('鼠');
    expect(z(1901, 2)).toBe(null);
    expect(z(1900, 3)).toBe('鼠');
  });

  it('names the animal in English too', () => {
    expect(zodiacAnimal({ birthYear: 1893 }, 'en')).toBe('Snake');
  });

  it('has an emoji for each animal, 🐑 for 羊', () => {
    expect(zodiacEmoji({ birthYear: 1715 })).toBe('🐑');
    expect(zodiacEmoji({ birthYear: 1984 })).toBe('🐭');
    expect(zodiacEmoji({ birthYear: 1898, birthMonth: 1 })).toBe(null);
  });
});
