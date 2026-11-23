import { describe, expect, it } from 'vitest';
import { aliases, isClanName, isSamePerson, type Identity } from '../person-identity';

const p = (name: string, extra: Partial<Identity> = {}): Identity => ({ name, ...extra });

describe('aliases', () => {
  it('includes the name, 字, 号 and each after the surname', () => {
    expect(aliases(p('蒋中正', { courtesyName: '介石' }))).toEqual(['蒋中正', '介石', '蒋介石']);
    expect(aliases(p('欧阳修文', { artName: '醉翁' }))).toEqual(['欧阳修文', '醉翁', '欧醉翁', '欧阳醉翁']);
  });

  it('includes other names as written, without the surname', () => {
    expect(aliases(p('甄英莲', { otherNames: ['香菱', '秋菱'] }))).toEqual(['甄英莲', '香菱', '秋菱']);
  });
});

describe('isClanName', () => {
  it('recognizes a surname followed by 氏', () => {
    expect([isClanName('王氏'), isClanName('欧阳氏'), isClanName('王采玉'), isClanName('氏')]).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe('isSamePerson', () => {
  it('matches the same name with the same or a missing birth year', () => {
    expect(isSamePerson(p('贾政', { birthYear: 1690 }), p('贾政', { birthYear: 1690 }))).toBe(true);
    expect(isSamePerson(p('贾政'), p('贾政', { birthYear: 1690 }))).toBe(true);
  });

  it('tells apart persons with different known birth dates', () => {
    expect(isSamePerson(p('贾政', { birthYear: 1690 }), p('贾政', { birthYear: 1700 }))).toBe(false);
    expect(isSamePerson(p('贾政', { birthYear: 1690, birthMonth: 3 }), p('贾政', { birthYear: 1690, birthMonth: 5 }))).toBe(false);
    expect(isSamePerson(p('贾政', { birthYear: 1690, birthMonth: 3 }), p('贾政', { birthYear: 1690 }))).toBe(true);
  });

  it('matches through 字 and 号', () => {
    expect(isSamePerson(p('蒋介石'), p('蒋中正', { courtesyName: '介石', birthYear: 1887 }))).toBe(true);
    expect(isSamePerson(p('蒋中正', { courtesyName: '介石' }), p('介石'))).toBe(true);
    expect(isSamePerson(p('贾宝玉'), p('贾政', { courtesyName: '存周' }))).toBe(false);
  });

  it('matches through other names', () => {
    expect(isSamePerson(p('香菱'), p('甄英莲', { otherNames: ['香菱'] }))).toBe(true);
    expect(isSamePerson(p('甄英莲', { otherNames: ['香菱'] }), p('香菱', { birthYear: 1710 }))).toBe(true);
    expect(isSamePerson(p('甄英莲'), p('香菱'))).toBe(false);
  });

  it('needs equal known birth years for surname-and-氏 names', () => {
    expect(isSamePerson(p('王氏'), p('王氏'))).toBe(false);
    expect(isSamePerson(p('王氏'), p('王氏', { birthYear: 1700 }))).toBe(false);
    expect(isSamePerson(p('王氏', { birthYear: 1700 }), p('王氏', { birthYear: 1700 }))).toBe(true);
  });
});
