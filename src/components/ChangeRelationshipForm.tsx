'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import type { Relationship, RelationshipFormData, RelationshipType, Person } from '@/types';
import { RelationshipType as RelType, Gender as GenderEnum } from '@/types';
import { compareByBirth } from '@/lib/tree-layout';
import { Loader2, Trash2, Edit, AlertTriangle } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { PersonAutocomplete } from '@/components/PersonAutocomplete';
import { DateInputs, FormGrid, RowLabel } from '@/components/FormLayout';
import { linkedPersonIds } from '@/lib/candidates';

interface ModifyOrRemoveRelationshipFormProps {
  isOpen: boolean;
  relationships: Relationship[];
  persons: Person[];
  preselectedPersonId?: string;
  onDelete: (relationshipId: string) => Promise<void>;
  onUpdate: (relationshipId: string, data: RelationshipFormData) => Promise<void>;
  onClose: () => void;
}

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  [RelType.PARENT_CHILD]: '父母子女',
  [RelType.SIBLING]: '兄弟姐妹',
  [RelType.HALF_SIBLING]: '同父异母/同母异父',
  [RelType.SPOUSE]: '配偶',
  [RelType.CONCUBINE]: '妾',
  [RelType.BETROTHED]: '订婚',
  [RelType.ADOPTIVE_PARENT]: '养父母',
  [RelType.FOSTER_PARENT]: '寄养父母',
  [RelType.SWORN_SIBLING]: '结拜兄弟姐妹',
};

// The other kinds of relationship, in the order the details panel lists them
const OTHER_ORDER: RelationshipType[] = [
  RelType.ADOPTIVE_PARENT,
  RelType.FOSTER_PARENT,
  RelType.CONCUBINE,
  RelType.BETROTHED,
  RelType.SWORN_SIBLING,
];

// Types a relationship can be changed to: the same kind, so its two persons and direction stay valid
const TYPE_FAMILIES: RelationshipType[][] = [
  [RelType.SPOUSE, RelType.CONCUBINE, RelType.BETROTHED],
  [RelType.PARENT_CHILD, RelType.ADOPTIVE_PARENT, RelType.FOSTER_PARENT],
  [RelType.SIBLING, RelType.HALF_SIBLING, RelType.SWORN_SIBLING],
];

export function ChangeRelationshipForm({
  isOpen,
  relationships,
  persons,
  preselectedPersonId,
  onDelete,
  onUpdate,
  onClose,
}: ModifyOrRemoveRelationshipFormProps) {
  const { toast } = useToast();
  const { t } = useLocale();
  const linkedIds = useMemo(() => linkedPersonIds(relationships), [relationships]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Person selection
  const [selectedPersonId, setSelectedPersonId] = useState('');

  // Selected relationship for editing
  const [editingRelationshipId, setEditingRelationshipId] = useState<string | null>(null);

  // Edit form state
  const [editType, setEditType] = useState<RelationshipType | null>(null);
  const [editStartYear, setEditStartYear] = useState<number | null>(null);
  const [editStartMonth, setEditStartMonth] = useState<number | null>(null);
  const [editStartDay, setEditStartDay] = useState<number | null>(null);
  const [editEndYear, setEditEndYear] = useState<number | null>(null);
  const [editEndMonth, setEditEndMonth] = useState<number | null>(null);
  const [editEndDay, setEditEndDay] = useState<number | null>(null);

  // Create a map for quick person lookup
  const personMap = useMemo(() => {
    const map = new Map<string, Person>();
    persons.forEach(p => map.set(p.id, p));
    return map;
  }, [persons]);

  // Get relationships for selected person
  const personRelationships = useMemo(() => {
    if (!selectedPersonId) return [];

    return relationships.filter(rel =>
      rel.personAId === selectedPersonId || rel.personBId === selectedPersonId
    ).map(rel => {
      const isPersonA = rel.personAId === selectedPersonId;
      const otherPersonId = isPersonA ? rel.personBId : rel.personAId;
      const otherPerson = personMap.get(otherPersonId);
      const otherName = otherPerson?.name || t('unknown');

      // For PARENT_CHILD, determine if the selected person is parent or child
      let relationshipDescription = RELATIONSHIP_LABELS[rel.type];
      if (rel.type === RelType.PARENT_CHILD) {
        if (isPersonA) {
          relationshipDescription = t('isParentOf').replace('{name}', otherName);
        } else {
          relationshipDescription = t('isChildOf').replace('{name}', otherName);
        }
      } else if (rel.type === RelType.SPOUSE) {
        relationshipDescription = t('spouseWith').replace('{name}', otherName);
      } else {
        relationshipDescription = t('relationshipWith').replace('{name}', otherName).replace('{type}', RELATIONSHIP_LABELS[rel.type]);
      }

      return {
        ...rel,
        otherPerson,
        otherPersonName: otherPerson?.name || t('unknown'),
        otherPersonGender: otherPerson?.gender,
        relationshipDescription,
        isPersonA,
      };
    }).sort((a, b) => {
      // As the relatives in the details panel: parents (father first), spouses in marriage order,
      // siblings and children eldest first, then the other kinds; by birth within each
      const group = (r: typeof a) =>
        r.type === RelType.PARENT_CHILD
          ? r.isPersonA ? 3 : 0
          : r.type === RelType.SPOUSE
            ? 1
            : r.type === RelType.SIBLING || r.type === RelType.HALF_SIBLING
              ? 2
              : 4 + OTHER_ORDER.indexOf(r.type);
      const gender = (r: typeof a) => (r.otherPersonGender === GenderEnum.MALE ? 0 : r.otherPersonGender === GenderEnum.FEMALE ? 1 : 2);
      return (
        group(a) - group(b) ||
        (group(a) === 0 ? gender(a) - gender(b) : 0) ||
        (group(a) === 1
          ? (a.startYear ?? Infinity) - (b.startYear ?? Infinity) ||
            (a.startMonth ?? 13) - (b.startMonth ?? 13) ||
            (a.startDay ?? 32) - (b.startDay ?? 32)
          : 0) ||
        (a.otherPerson && b.otherPerson ? compareByBirth(a.otherPerson, b.otherPerson) : 0)
      );
    });
  }, [selectedPersonId, relationships, personMap, t]);

  // Reset when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPersonId(preselectedPersonId || '');
      setEditingRelationshipId(null);
    }
  }, [isOpen, preselectedPersonId]);

  // Populate edit form when relationship is selected
  useEffect(() => {
    if (editingRelationshipId) {
      const rel = relationships.find(r => r.id === editingRelationshipId);
      if (rel) {
        setEditType(rel.type);
        setEditStartYear(rel.startYear || null);
        setEditStartMonth(rel.startMonth || null);
        setEditStartDay(rel.startDay || null);
        setEditEndYear(rel.endYear || null);
        setEditEndMonth(rel.endMonth || null);
        setEditEndDay(rel.endDay || null);
      }
    }
  }, [editingRelationshipId, relationships]);

  const handleDelete = async (relationshipId: string) => {
    setIsDeleting(true);
    try {
      await onDelete(relationshipId);
      toast({
        title: t('relationshipDeleted'),
        description: t('relationshipDeleted'),
      });
      setEditingRelationshipId(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('failedToDeleteRelationship'),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingRelationshipId) return;

    const rel = relationships.find(r => r.id === editingRelationshipId);
    if (!rel) return;

    setIsUpdating(true);
    try {
      const data: RelationshipFormData = {
        personAId: rel.personAId,
        personBId: rel.personBId,
        type: editType ?? rel.type,
        startYear: editStartYear,
        startMonth: editStartMonth,
        startDay: editStartDay,
        endYear: editEndYear,
        endMonth: editEndMonth,
        endDay: editEndDay,
      };

      await onUpdate(editingRelationshipId, data);
      toast({
        title: t('relationshipUpdated'),
        description: t('relationshipUpdated'),
      });
      setEditingRelationshipId(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('failedToUpdateRelationship'),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            {t('changeRelationship')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Person Selection - only show if no preselected person */}
          {!preselectedPersonId && (
            <FormGrid>
              <PersonAutocomplete
                inline
                value={selectedPersonId}
                onChange={setSelectedPersonId}
                persons={persons}
                linkedIds={linkedIds}
                placeholder={t('searchByName')}
                label={t('selectPerson')}
              />
            </FormGrid>
          )}

          {/* Relationships List */}
          {selectedPersonId && personRelationships.length > 0 && (
            <div className="space-y-2">
              <Label>{t('personRelationships')}</Label>
              <div className="max-h-[200px] overflow-y-auto border rounded-md">
                {personRelationships.map((rel) => (
                  <div
                    key={rel.id}
                    className={`px-4 py-3 cursor-pointer border-b last:border-b-0 flex items-center justify-between ${
                      editingRelationshipId === rel.id
                        ? 'bg-accent'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setEditingRelationshipId(
                      editingRelationshipId === rel.id ? null : rel.id
                    )}
                  >
                    <div>
                      <div className="font-medium text-sm">{rel.relationshipDescription}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedPersonId && personRelationships.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              {t('noRelationships')}
            </p>
          )}

          {/* Edit Form */}
          {editingRelationshipId && (
            <div className="border rounded-md p-4 space-y-4 bg-muted/30">
              {(() => {
                const rel = personRelationships.find(r => r.id === editingRelationshipId);
                if (!rel) return null;

                return (
                  <>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      {t('editRelationship')}
                    </div>

                    <FormGrid>
                      {/* Type: within the same kind, so the two persons and direction stay valid */}
                      <RowLabel htmlFor="edit-type">{t('relationshipType')}</RowLabel>
                      <Select value={editType ?? rel.type} onValueChange={(value) => setEditType(value as RelationshipType)}>
                        <SelectTrigger id="edit-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(TYPE_FAMILIES.find((family) => family.includes(rel.type)) ?? [rel.type]).map((type) => (
                            <SelectItem key={type} value={type}>
                              {RELATIONSHIP_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <RowLabel htmlFor="edit-start">{t('startDate')}</RowLabel>
                      <DateInputs
                        id="edit-start"
                        value={{ year: editStartYear, month: editStartMonth, day: editStartDay }}
                        onChange={(part, value) =>
                          ({ year: setEditStartYear, month: setEditStartMonth, day: setEditStartDay })[part](value)
                        }
                      />

                      <RowLabel htmlFor="edit-end">{t('endDate')}</RowLabel>
                      <DateInputs
                        id="edit-end"
                        value={{ year: editEndYear, month: editEndMonth, day: editEndDay }}
                        onChange={(part, value) =>
                          ({ year: setEditEndYear, month: setEditEndMonth, day: setEditEndDay })[part](value)
                        }
                      />
                    </FormGrid>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleUpdate}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('updating')}
                          </>
                        ) : (
                          <>
                            <Edit className="w-4 h-4 mr-2" />
                            {t('save')}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleDelete(editingRelationshipId)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('deleting')}
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('deleteRelationship')}
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
