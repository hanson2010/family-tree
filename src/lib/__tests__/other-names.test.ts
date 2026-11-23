import { describe, expect, it } from 'vitest';
import { formatOtherNames, mergeOtherNames, normalizeOtherNames, parseOtherNames } from '../other-names';

describe('normalizeOtherNames', () => {
  it('trims, drops blanks and repeats, and sorts by pinyin', () => {
    expect(normalizeOtherNames([' 香菱 ', '', '秋菱', '香菱', '阿凤'])).toEqual(['阿凤', '秋菱', '香菱']);
    expect(normalizeOtherNames(undefined)).toEqual([]);
  });
});

describe('parseOtherNames', () => {
  it('splits on 、 , ， ; ； / and new lines', () => {
    expect(parseOtherNames('香菱、秋菱,英莲，甲;乙；丙/丁\n戊')).toEqual(normalizeOtherNames(['香菱', '秋菱', '英莲', '甲', '乙', '丙', '丁', '戊']));
    expect(parseOtherNames(' 、 ')).toEqual([]);
  });

  it('round-trips with formatOtherNames', () => {
    expect(parseOtherNames(formatOtherNames(['秋菱', '香菱']))).toEqual(['秋菱', '香菱']);
  });
});

describe('mergeOtherNames', () => {
  it('keeps both lists and the name not kept, without the merged name', () => {
    expect(mergeOtherNames({ name: '甄英莲', otherNames: ['秋菱'] }, { name: '香菱' }, '甄英莲')).toEqual(['秋菱', '香菱']);
    expect(mergeOtherNames({ name: '甄英莲' }, { name: '甄英莲', otherNames: ['香菱'] }, '甄英莲')).toEqual(['香菱']);
  });
});
