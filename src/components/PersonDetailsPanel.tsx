'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/LocaleProvider';
import { useSession } from 'next-auth/react';
import { PersonAvatar } from '@/components/PersonAvatar';
import type { Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';
import type { TranslationKey } from '@/lib/i18n';
import { formatOtherNames } from '@/lib/other-names';
import { WebLink } from '@/components/WebLink';
import { compareByBirth } from '@/lib/tree-layout';
import { GitBranch, GitMerge, Lock, MousePointerClick, Pencil, Trash2 } from 'lucide-react';

interface PersonDetailsPanelProps {
  person: Person | null;
  persons: Person[];
  relationships: Relationship[];
  /** Whether the signed-in user may edit and delete this person */
  canEdit: boolean;
  onSelectPerson: (personId: string) => void;
  onEdit: (person: Person) => void;
  onDelete: (person: Person) => void;
  /** Merge another person into this one */
  onMerge?: (person: Person) => void;
  onChangeRelationships?: (person: Person) => void;
}

interface RelativeGroup {
  title: string;
  members: Array<{ person: Person; note?: string }>;
}

const OTHER_TYPE_LABELS: Partial<Record<RelationshipType, TranslationKey>> = {
  [RelationshipType.CONCUBINE]: 'concubine',
  [RelationshipType.BETROTHED]: 'betrothed',
  [RelationshipType.ADOPTIVE_PARENT]: 'adoptiveParent',
  [RelationshipType.FOSTER_PARENT]: 'fosterParent',
  [RelationshipType.SWORN_SIBLING]: 'swornSibling',
};

/** Other relations by type, then by birth within a type */
const OTHER_TYPE_ORDER: RelationshipType[] = [
  RelationshipType.ADOPTIVE_PARENT,
  RelationshipType.FOSTER_PARENT,
  RelationshipType.CONCUBINE,
  RelationshipType.BETROTHED,
  RelationshipType.SWORN_SIBLING,
];

/** Earliest start date first; a relationship without one goes last */
/**
 * Age at death, when both years are known. In Chinese it is 享年 in 虚岁, as genealogies count it
 * (the death year minus the birth year, plus one); in English, completed years, exact when both
 * full dates are known and "about" otherwise.
 */
function ageAtDeath(p: Person, locale: string): string | null {
  if (p.birthYear == null || p.deathYear == null || p.deathYear < p.birthYear) return null;
  if (locale === 'zh') return `${p.deathYear - p.birthYear + 1} 岁`;
  const exact = p.birthMonth != null && p.birthDay != null && p.deathMonth != null && p.deathDay != null;
  if (!exact) return `about ${p.deathYear - p.birthYear}`;
  const beforeBirthday = p.deathMonth! < p.birthMonth! || (p.deathMonth === p.birthMonth && p.deathDay! < p.birthDay!);
  return String(p.deathYear - p.birthYear - (beforeBirthday ? 1 : 0));
}

const byStartDate = (a: Relationship, b: Relationship) =>
  (a.startYear ?? Infinity) - (b.startYear ?? Infinity) ||
  (a.startMonth ?? 13) - (b.startMonth ?? 13) ||
  (a.startDay ?? 32) - (b.startDay ?? 32);

/** Father before mother (unknown gender last), then by birth */
const genderRank = (p: Person) => (p.gender === Gender.MALE ? 0 : p.gender === Gender.FEMALE ? 1 : 2);

export function PersonDetailsPanel({
  person,
  persons,
  relationships,
  canEdit,
  onSelectPerson,
  onEdit,
  onDelete,
  onMerge,
  onChangeRelationships,
}: PersonDetailsPanelProps) {
  const { t, locale } = useLocale();
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const groups = React.useMemo<RelativeGroup[]>(() => {
    if (!person) return [];

    const byId = new Map(persons.map((p) => [p.id, p]));
    const parents: Person[] = [];
    const spouses: { person: Person; rel: Relationship }[] = [];
    const children: Person[] = [];
    const siblings = new Map<string, Person>();
    const others: { person: Person; rel: Relationship }[] = [];

    for (const rel of relationships) {
      const isA = rel.personAId === person.id;
      if (!isA && rel.personBId !== person.id) continue;
      const other = byId.get(isA ? rel.personBId : rel.personAId);
      if (!other) continue;

      switch (rel.type) {
        case RelationshipType.PARENT_CHILD:
          // Person A is the parent of person B
          (isA ? children : parents).push(other);
          break;
        case RelationshipType.SPOUSE:
          spouses.push({ person: other, rel });
          break;
        case RelationshipType.SIBLING:
        case RelationshipType.HALF_SIBLING:
          siblings.set(other.id, other);
          break;
        default:
          others.push({ person: other, rel });
      }
    }

    // Children of the same parents are siblings even without an explicit relationship
    const parentIds = new Set(parents.map((p) => p.id));
    for (const rel of relationships) {
      if (rel.type !== RelationshipType.PARENT_CHILD) continue;
      if (!parentIds.has(rel.personAId) || rel.personBId === person.id) continue;
      const sibling = byId.get(rel.personBId);
      if (sibling) siblings.set(sibling.id, sibling);
    }

    // Each person once per group, even if the same relationship is stored more than once
    const toMembers = (list: Person[]) =>
      list.filter((p, i) => list.findIndex((q) => q.id === p.id) === i).map((p) => ({ person: p }));
    // Parents: father, then mother. Spouses: in marriage order. Siblings and children: eldest
    // first. Others: by kind of relationship, then by birth.
    parents.sort((a, b) => genderRank(a) - genderRank(b) || compareByBirth(a, b));
    spouses.sort((a, b) => byStartDate(a.rel, b.rel) || compareByBirth(a.person, b.person));
    others.sort(
      (a, b) =>
        OTHER_TYPE_ORDER.indexOf(a.rel.type) - OTHER_TYPE_ORDER.indexOf(b.rel.type) ||
        compareByBirth(a.person, b.person)
    );
    return [
      { title: t('parents'), members: toMembers(parents) },
      { title: t('spouses'), members: toMembers(spouses.map((s) => s.person)) },
      { title: t('siblings'), members: toMembers(Array.from(siblings.values()).sort(compareByBirth)) },
      { title: t('children'), members: toMembers(children.sort(compareByBirth)) },
      {
        title: t('otherRelations'),
        members: others.map(({ person: other, rel }) => {
          const labelKey = OTHER_TYPE_LABELS[rel.type];
          return { person: other, note: labelKey ? t(labelKey) : rel.type };
        }),
      },
    ].filter((group) => group.members.length > 0);
  }, [person, persons, relationships, t]);

  if (!person) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <MousePointerClick className="h-8 w-8 opacity-50" />
        <p className="text-sm">{t('selectPersonHint')}</p>
      </div>
    );
  }

  const formatDate = (year?: number | null, month?: number | null, day?: number | null) => {
    if (!year && !month && !day) return null;
    if (locale === 'zh') {
      return `${year ? `${year}年` : ''}${month ? `${month}月` : ''}${day ? `${day}日` : ''}`;
    }
    return [year, month, day]
      .filter(Boolean)
      .map((part) => String(part).padStart(2, '0'))
      .join('-');
  };

  const birthDate = formatDate(person.birthYear, person.birthMonth, person.birthDay);
  const deathDate = formatDate(person.deathYear, person.deathMonth, person.deathDay);

  const genderLabel =
    person.gender === Gender.MALE ? t('male') : person.gender === Gender.FEMALE ? t('female') : t('unknown');

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: t('courtesyName'), value: person.courtesyName },
    { label: t('artName'), value: person.artName },
    { label: t('otherNames'), value: formatOtherNames(person.otherNames) },
    { label: t('gender'), value: genderLabel },
    { label: t('birthDate'), value: birthDate },
    { label: t('deathDate'), value: deathDate },
    { label: t('ageAtDeath'), value: ageAtDeath(person, locale) },
    { label: t('link'), value: person.link ? <WebLink href={person.link} /> : null },
  ].filter((fact) => fact.value);

  return (
    <div className="space-y-6 p-4">
      {/* Identity */}
      <div className="flex items-center gap-4">
        <PersonAvatar person={person} className="h-16 w-16 border-2 border-card text-2xl shadow-sm" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display break-words text-xl font-semibold leading-tight">{person.name}</h2>
          {(person.birthYear || person.deathYear) && (
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {person.birthYear ?? '?'} – {person.deathYear ?? ''}
            </p>
          )}
          {person.isPrivate && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              <Lock className="h-3 w-3" />
              {t('private')}
            </span>
          )}
        </div>
      </div>

      {/* Facts */}
      <dl className="divide-y rounded-lg border bg-card text-sm">
        {facts.map((fact) => (
          <div key={fact.label} className="flex justify-between gap-4 px-3 py-2">
            <dt className="shrink-0 text-muted-foreground">{fact.label}</dt>
            <dd className="min-w-0 text-right">{fact.value}</dd>
          </div>
        ))}
      </dl>

      {/* Description */}
      {person.description && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('description')}</h3>
          <p className="whitespace-pre-line break-words text-sm leading-relaxed">{person.description}</p>
        </div>
      )}

      {/* Relatives */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('relatives')}</h3>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noRelatives')}</p>
        ) : (
          groups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="text-xs text-muted-foreground">{group.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.members.map(({ person: relative, note }, index) => (
                  <button
                    key={`${relative.id}-${index}`}
                    type="button"
                    onClick={() => onSelectPerson(relative.id)}
                    className="flex max-w-full items-center gap-1.5 rounded-full border bg-card py-0.5 pl-0.5 pr-2.5 text-sm transition-colors hover:border-foreground/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PersonAvatar person={relative} className="h-6 w-6 text-[11px]" />
                    <span className="truncate">{relative.name}</span>
                    {note && <span className="shrink-0 text-xs text-muted-foreground">{note}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Actions */}
      {isAuthenticated && (
        <div className="space-y-2 border-t pt-4">
          {canEdit && (
            <Button variant="outline" size="sm" className="w-full justify-start bg-card" onClick={() => onEdit(person)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('editPerson')}
            </Button>
          )}
          {canEdit && onMerge && (
            <Button variant="outline" size="sm" className="w-full justify-start bg-card" onClick={() => onMerge(person)}>
              <GitMerge className="mr-2 h-4 w-4" />
              {t('mergePerson')}
            </Button>
          )}
          {onChangeRelationships && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start bg-card"
              onClick={() => onChangeRelationships(person)}
            >
              <GitBranch className="mr-2 h-4 w-4" />
              {t('changeRelationship')}
            </Button>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete(person)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('delete')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
