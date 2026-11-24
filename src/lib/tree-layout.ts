import type { Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';
import { orderUnions } from '@/lib/marriage-order';

/**
 * Family tree layout: one row per generation, in a fixed order.
 *
 * - A couple sits together, the husband on the left and his partners to his right
 *   (wives, concubines and betrothed alike, by the union's start date, an undated one by the
 *   partner's birth; see orderUnions). The couple is mirrored when that makes fewer
 *   parent-child lines cross.
 * - Siblings run from oldest to youngest.
 * - A sibling group sits under the couple it descends from, and groups follow the
 *   order of their parents in the row above.
 * - The parents of someone who married in sit beside the parents of their partner:
 *   to the right for a wife, to the left for a husband.
 */

export const PARTNER_TYPES: RelationshipType[] = [
  RelationshipType.SPOUSE,
  RelationshipType.CONCUBINE,
  RelationshipType.BETROTHED,
];

export const PARENTAL_TYPES: RelationshipType[] = [
  RelationshipType.PARENT_CHILD,
  RelationshipType.ADOPTIVE_PARENT,
  RelationshipType.FOSTER_PARENT,
];

const SIBLING_TYPES: RelationshipType[] = [RelationshipType.SIBLING, RelationshipType.HALF_SIBLING];

export interface LayoutOptions {
  /** Distance between the centers of two persons next to each other */
  nodeSpacing: number;
  /** Extra space between siblings */
  siblingGap: number;
  /** Extra space between persons from different families */
  familyGap: number;
  /** Distance between generation rows */
  generationHeight: number;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  nodeSpacing: 100,
  siblingGap: 12,
  familyGap: 48,
  generationHeight: 150,
};

export interface TreeLayout {
  positions: Map<string, { x: number; y: number }>;
}

type LayoutPerson = Pick<Person, 'id' | 'name' | 'gender' | 'birthYear' | 'birthMonth' | 'birthDay' | 'relativeGeneration'>;

interface Unit {
  /** Persons left to right: husband first, then his partners */
  members: string[];
  /** Unit holding the parents this unit descends from, in the row above */
  parentUnit: Unit | null;
  /** Units joined by sibling relationships share a group even without visible parents */
  group: number;
  x: number;
}

/** Oldest first; persons without a birth year go last, then by name */
export function compareByBirth(a: LayoutPerson, b: LayoutPerson): number {
  const year = (p: LayoutPerson) => p.birthYear ?? Number.POSITIVE_INFINITY;
  return (
    year(a) - year(b) ||
    (a.birthMonth ?? 13) - (b.birthMonth ?? 13) ||
    (a.birthDay ?? 32) - (b.birthDay ?? 32) ||
    a.name.localeCompare(b.name, 'zh-Hans-CN') ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Positions in a fixed order that minimize the squared distance to `desired`, keeping
 * neighbours at least `minGap[i]` apart (between i and i + 1). Pool-adjacent-violators.
 */
function placeInOrder(desired: number[], minGap: number[]): number[] {
  const offsets = [0];
  for (let i = 1; i < desired.length; i++) offsets.push(offsets[i - 1] + minGap[i - 1]);
  const blocks: { sum: number; count: number }[] = [];
  desired.forEach((d, i) => {
    blocks.push({ sum: d - offsets[i], count: 1 });
    while (blocks.length > 1) {
      const last = blocks[blocks.length - 1];
      const prev = blocks[blocks.length - 2];
      if (prev.sum / prev.count <= last.sum / last.count) break;
      prev.sum += last.sum;
      prev.count += last.count;
      blocks.pop();
    }
  });
  const result: number[] = [];
  blocks.forEach((b) => {
    for (let i = 0; i < b.count; i++) result.push(b.sum / b.count + offsets[result.length]);
  });
  return result;
}

export function layoutFamilyTree(
  persons: LayoutPerson[],
  relationships: Relationship[],
  options: LayoutOptions = DEFAULT_LAYOUT_OPTIONS
): TreeLayout {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const gen = (id: string) => byId.get(id)?.relativeGeneration ?? 0;
  const visible = relationships.filter((r) => byId.has(r.personAId) && byId.has(r.personBId));

  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const partnersOf = new Map<string, Relationship[]>();
  const siblingsOf = new Map<string, string[]>();
  const push = <K, T>(map: Map<K, T[]>, key: K, value: T) => {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };
  visible.forEach((r) => {
    if (PARENTAL_TYPES.includes(r.type)) {
      push(parentsOf, r.personBId, r.personAId);
      push(childrenOf, r.personAId, r.personBId);
    } else if (PARTNER_TYPES.includes(r.type) && gen(r.personAId) === gen(r.personBId)) {
      push(partnersOf, r.personAId, r);
      push(partnersOf, r.personBId, r);
    } else if (SIBLING_TYPES.includes(r.type)) {
      push(siblingsOf, r.personAId, r.personBId);
      push(siblingsOf, r.personBId, r.personAId);
    }
  });

  // Rows of persons, top generation first
  const rowsByGen = new Map<number, LayoutPerson[]>();
  persons.forEach((p) => push(rowsByGen, gen(p.id), p));
  const generations = Array.from(new Set(persons.map((p) => gen(p.id)))).sort((a, b) => a - b);

  // Couples: each man (oldest first) takes his partners; then whoever is left
  const unitOf = new Map<string, Unit>();
  const unitRows: Unit[][] = generations.map((g) => {
    const row = [...(rowsByGen.get(g) ?? [])].sort(compareByBirth);
    const units: Unit[] = [];
    const take = (lead: LayoutPerson) => {
      if (unitOf.has(lead.id)) return;
      const rank = (r: Relationship) => PARTNER_TYPES.indexOf(r.type);
      const partners = orderUnions(
        (partnersOf.get(lead.id) ?? [])
          .map((r) => ({ r, other: byId.get(r.personAId === lead.id ? r.personBId : r.personAId)! }))
          .filter(({ other }) => !unitOf.has(other.id) && other.gender !== Gender.MALE),
        ({ r }) => r,
        ({ other }) => other,
        (a, b) => rank(a.r) - rank(b.r) || compareByBirth(a.other, b.other)
      ).map(({ other }) => other.id);
      const unit: Unit = { members: [lead.id, ...new Set(partners)], parentUnit: null, group: -1, x: 0 };
      unit.members.forEach((id) => unitOf.set(id, unit));
      units.push(unit);
    };
    // A woman married more than once stands between her husbands: the first (by marriage date,
    // then birth) on her left, the later ones on her right. Only when none of them has another
    // partner in this row; otherwise the usual couples below.
    const byMarriage = (a: { r: Relationship; other: LayoutPerson }, b: { r: Relationship; other: LayoutPerson }) =>
      (a.r.startYear ?? Number.POSITIVE_INFINITY) - (b.r.startYear ?? Number.POSITIVE_INFINITY) ||
      (a.r.startMonth ?? 13) - (b.r.startMonth ?? 13) ||
      (a.r.startDay ?? 32) - (b.r.startDay ?? 32) ||
      compareByBirth(a.other, b.other);
    row
      .filter((p) => p.gender !== Gender.MALE)
      .forEach((woman) => {
        const husbands = (partnersOf.get(woman.id) ?? [])
          .map((r) => ({ r, other: byId.get(r.personAId === woman.id ? r.personBId : r.personAId)! }))
          .filter(({ other }) => other.gender === Gender.MALE && !unitOf.has(other.id));
        const ids = [...new Set(husbands.map(({ other }) => other.id))];
        if (ids.length < 2 || unitOf.has(woman.id)) return;
        const onlyHers = ids.every((id) =>
          (partnersOf.get(id) ?? []).every((r) => r.personAId === woman.id || r.personBId === woman.id)
        );
        if (!onlyHers) return;
        const [first, ...later] = [...new Set(husbands.sort(byMarriage).map(({ other }) => other.id))];
        const unit: Unit = { members: [first, woman.id, ...later], parentUnit: null, group: -1, x: 0 };
        unit.members.forEach((id) => unitOf.set(id, unit));
        units.push(unit);
      });
    row.filter((p) => p.gender === Gender.MALE).forEach(take);
    row.forEach(take);
    return units;
  });

  // The unit each unit descends from: the first member (husband first) with parents in the row above
  unitRows.forEach((units, rowIndex) => {
    const above = generations[rowIndex] - 1;
    units.forEach((unit) => {
      for (const id of unit.members) {
        const parents = (parentsOf.get(id) ?? []).filter((p) => gen(p) === above);
        const father = parents.find((p) => byId.get(p)?.gender === Gender.MALE) ?? parents[0];
        if (father) {
          unit.parentUnit = unitOf.get(father)!;
          break;
        }
      }
    });
  });

  // Sibling groups: units with the same parent unit, or joined by sibling relationships
  let nextGroup = 0;
  unitRows.forEach((units) => {
    const groupOfParent = new Map<Unit, number>();
    units.forEach((unit) => {
      if (unit.parentUnit) {
        if (!groupOfParent.has(unit.parentUnit)) groupOfParent.set(unit.parentUnit, nextGroup++);
        unit.group = groupOfParent.get(unit.parentUnit)!;
      }
    });
    // Spread groups across sibling relationships until nothing changes
    let changed = true;
    while (changed) {
      changed = false;
      units.forEach((unit) => {
        for (const id of unit.members) {
          for (const sib of siblingsOf.get(id) ?? []) {
            const other = unitOf.get(sib);
            if (!other || other === unit || !units.includes(other)) continue;
            if (unit.group < 0 && other.group >= 0) {
              unit.group = other.group;
              unit.parentUnit = other.parentUnit;
              changed = true;
            } else if (unit.group >= 0 && other.group < 0) {
              other.group = unit.group;
              other.parentUnit = unit.parentUnit;
              changed = true;
            }
          }
        }
      });
      if (!changed) {
        const loose = units.find((u) => u.group < 0);
        if (loose) {
          loose.group = nextGroup++;
          changed = true;
        }
      }
    }
  });

  // Order each row, top down
  const leadOf = (unit: Unit) => byId.get(unit.members[0])!;
  const ordered: Unit[][] = [];
  unitRows.forEach((units, rowIndex) => {
    const groups = new Map<number, Unit[]>();
    units.forEach((u) => push(groups, u.group, u));
    const groupList = Array.from(groups.values()).map((members) => {
      // The member descending from the parents decides the order among siblings
      const blood = (u: Unit) =>
        byId.get(u.members.find((id) => (parentsOf.get(id) ?? []).length > 0) ?? u.members[0])!;
      // Children of the same couple stay together, under where their parents stand in the parent
      // unit: a man's children by each wife in the order of the wives (those with only him
      // recorded first, under him), a twice-married woman's children by each husband on that
      // husband's side. Oldest first within each.
      const underParents = (u: Unit) => {
        const parentUnit = u.parentUnit;
        if (!parentUnit) return Number.POSITIVE_INFINITY;
        const at = (parentsOf.get(blood(u).id) ?? [])
          .map((p) => parentUnit.members.indexOf(p))
          .filter((i) => i >= 0);
        return at.length > 0 ? at.reduce((sum, i) => sum + i, 0) / at.length : Number.POSITIVE_INFINITY;
      };
      return members.sort((a, b) => underParents(a) - underParents(b) || compareByBirth(blood(a), blood(b)));
    });

    const above = rowIndex > 0 ? ordered[rowIndex - 1] : [];
    const placed: Unit[][] = groupList
      .filter((g) => g[0].parentUnit && above.includes(g[0].parentUnit))
      .sort((a, b) => above.indexOf(a[0].parentUnit!) - above.indexOf(b[0].parentUnit!));
    let pending = groupList.filter((g) => !placed.includes(g));

    // A group without parents here goes beside the parents of its children's partners
    const anchor = (group: Unit[]): { at: Unit[]; before: boolean } | null => {
      for (const unit of group) {
        for (const id of unit.members) {
          for (const child of childrenOf.get(id) ?? []) {
            const childUnit = unitOf.get(child);
            if (!childUnit || !childUnit.parentUnit || childUnit.parentUnit === unit) continue;
            const at = placed.find((g) => g.includes(childUnit.parentUnit!));
            if (at) return { at, before: byId.get(child)?.gender === Gender.MALE };
          }
        }
      }
      return null;
    };
    while (pending.length > 0) {
      const resolvable = pending.find((g) => anchor(g));
      if (resolvable) {
        const { at, before } = anchor(resolvable)!;
        placed.splice(placed.indexOf(at) + (before ? 0 : 1), 0, resolvable);
        pending = pending.filter((g) => g !== resolvable);
      } else {
        // Start with a family's own line; the parents of those who married in can then
        // be placed beside it
        const marriedInto = (group: Unit[]) =>
          group.some((unit) =>
            unit.members.some((id) =>
              (childrenOf.get(id) ?? []).some((child) => {
                const childUnit = unitOf.get(child);
                return !!childUnit?.parentUnit && childUnit.parentUnit !== unit;
              })
            )
          );
        pending.sort(
          (a, b) => Number(marriedInto(a)) - Number(marriedInto(b)) || compareByBirth(leadOf(a[0]), leadOf(b[0]))
        );
        placed.push(pending.shift()!);
      }
    }
    ordered.push(placed.flat());
  });

  // A couple flips to wife on the left when that makes fewer parent-child lines cross
  const crossingsBelow = (r: number): number => {
    if (r < 0 || r + 1 >= ordered.length) return 0;
    const index = (row: Unit[]) => new Map(row.flatMap((u) => u.members).map((id, i) => [id, i]));
    const upper = index(ordered[r]);
    const lower = index(ordered[r + 1]);
    const lines: [number, number][] = [];
    upper.forEach((i, id) => {
      (childrenOf.get(id) ?? []).forEach((child) => {
        const j = lower.get(child);
        if (j !== undefined) lines.push([i, j]);
      });
    });
    let crossings = 0;
    for (let a = 0; a < lines.length; a++) {
      for (let b = a + 1; b < lines.length; b++) {
        if ((lines[a][0] - lines[b][0]) * (lines[a][1] - lines[b][1]) < 0) crossings++;
      }
    }
    return crossings;
  };
  for (let pass = 0, improved = true; improved && pass < 10; pass++) {
    improved = false;
    ordered.forEach((row, r) => {
      row.forEach((unit) => {
        if (unit.members.length < 2) return;
        const before = crossingsBelow(r - 1) + crossingsBelow(r);
        unit.members.reverse();
        if (crossingsBelow(r - 1) + crossingsBelow(r) < before) improved = true;
        else unit.members.reverse();
      });
    });
  }

  // Horizontal positions: each unit is pulled toward its parents and its children
  const { nodeSpacing, siblingGap, familyGap, generationHeight } = options;
  const width = (u: Unit) => u.members.length * nodeSpacing;
  const gaps = ordered.map((row) =>
    row.slice(1).map((u, i) => {
      const prev = row[i];
      return (width(prev) + width(u)) / 2 + (prev.group === u.group ? siblingGap : familyGap);
    })
  );
  ordered.forEach((row, r) => {
    let x = 0;
    row.forEach((u, i) => {
      if (i > 0) x += gaps[r][i - 1];
      u.x = x;
    });
  });

  const offset = (u: Unit, id: string) => (u.members.indexOf(id) - (u.members.length - 1) / 2) * nodeSpacing;
  const xOf = (id: string) => {
    const u = unitOf.get(id)!;
    return u.x + offset(u, id);
  };
  const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

  // Alternate top-down and bottom-up sweeps; each member pulls the unit so that it sits
  // centered under its parents and over its children
  for (let sweep = 0; sweep < 24; sweep++) {
    const rows = sweep % 2 === 0 ? ordered.map((_, i) => i) : ordered.map((_, i) => ordered.length - 1 - i);
    rows.forEach((r) => {
      const row = ordered[r];
      const desired = row.map((u) => {
        const pulls: number[] = [];
        u.members.forEach((id) => {
          const parents = (parentsOf.get(id) ?? []).filter((p) => gen(p) === gen(id) - 1);
          const children = (childrenOf.get(id) ?? []).filter((c) => gen(c) === gen(id) + 1);
          if (parents.length) pulls.push(mean(parents.map(xOf)) - offset(u, id));
          if (children.length) pulls.push(mean(children.map(xOf)) - offset(u, id));
        });
        return pulls.length ? mean(pulls) : u.x;
      });
      placeInOrder(desired, gaps[r]).forEach((x, i) => {
        row[i].x = x;
      });
    });
  }

  const positions = new Map<string, { x: number; y: number }>();
  ordered.forEach((row) =>
    row.forEach((u) => u.members.forEach((id) => positions.set(id, { x: xOf(id), y: gen(id) * generationHeight })))
  );

  return { positions };
}
