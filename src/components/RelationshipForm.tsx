'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { RelationshipType as RelType } from '@/types';
import { Loader2 } from 'lucide-react';

interface RelationshipFormProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  relationship?: Relationship | null;
  persons: Person[];
  preselectedPersonA?: string;
  preselectedPersonB?: string;
  onSubmit: (data: RelationshipFormData) => Promise<void>;
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

const RELATIONSHIP_DESCRIPTIONS: Record<RelationshipType, string> = {
  [RelType.PARENT_CHILD]: '甲是乙的父母',
  [RelType.SIBLING]: '甲和乙是兄弟姐妹',
  [RelType.HALF_SIBLING]: '甲和乙同父异母或同母异父',
  [RelType.SPOUSE]: '甲和乙是配偶',
  [RelType.CONCUBINE]: '甲是乙的妾',
  [RelType.BETROTHED]: '甲和乙已订婚',
  [RelType.ADOPTIVE_PARENT]: '甲是乙的养父母',
  [RelType.FOSTER_PARENT]: '甲是乙的寄养父母',
  [RelType.SWORN_SIBLING]: '甲和乙是结拜兄弟姐妹',
};

// Relationship types that should not be shown in the form (auto-calculated)
const HIDDEN_RELATIONSHIP_TYPES = [RelType.SIBLING, RelType.HALF_SIBLING];

export function RelationshipForm({
  isOpen,
  mode,
  relationship,
  persons,
  preselectedPersonA,
  preselectedPersonB,
  onSubmit,
  onClose,
}: RelationshipFormProps) {
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<RelationshipFormData>({
    personAId: relationship?.personAId || preselectedPersonA || '',
    personBId: relationship?.personBId || preselectedPersonB || '',
    type: relationship?.type || RelType.PARENT_CHILD,
    startYear: relationship?.startYear || null,
    startMonth: relationship?.startMonth || null,
    startDay: relationship?.startDay || null,
    endYear: relationship?.endYear || null,
    endMonth: relationship?.endMonth || null,
    endDay: relationship?.endDay || null,
  });

  // Reset form when relationship changes
  useEffect(() => {
    if (relationship) {
      setFormData({
        personAId: relationship.personAId,
        personBId: relationship.personBId,
        type: relationship.type,
        startYear: relationship.startYear || null,
        startMonth: relationship.startMonth || null,
        startDay: relationship.startDay || null,
        endYear: relationship.endYear || null,
        endMonth: relationship.endMonth || null,
        endDay: relationship.endDay || null,
      });
    } else {
      setFormData({
        personAId: preselectedPersonA || '',
        personBId: preselectedPersonB || '',
        type: RelType.PARENT_CHILD,
        startYear: null,
        startMonth: null,
        startDay: null,
        endYear: null,
        endMonth: null,
        endDay: null,
      });
    }
  }, [relationship, preselectedPersonA, preselectedPersonB]);

  // Track previous relationship type for clearing start date
  const prevTypeRef = React.useRef<RelationshipType>(formData.type);

  // Auto-fill start date with child's birth date for PARENT_CHILD relationship
  // Clear start date when switching from PARENT_CHILD to other types
  useEffect(() => {
    const prevType = prevTypeRef.current;
    prevTypeRef.current = formData.type;

    if (formData.type === RelType.PARENT_CHILD && formData.personBId && !relationship) {
      // Auto-fill start date with child's birth date
      const child = persons.find(p => p.id === formData.personBId);
      if (child && (child.birthYear || child.birthMonth || child.birthDay)) {
        setFormData(prev => ({
          ...prev,
          startYear: child.birthYear || null,
          startMonth: child.birthMonth || null,
          startDay: child.birthDay || null,
        }));
      }
    } else if (prevType === RelType.PARENT_CHILD && formData.type !== RelType.PARENT_CHILD && !relationship) {
      // Clear start date when switching from PARENT_CHILD to other types
      setFormData(prev => ({
        ...prev,
        startYear: null,
        startMonth: null,
        startDay: null,
      }));
    }
  }, [formData.type, formData.personBId, persons, relationship]);

  const handleInputChange = (field: keyof RelationshipFormData, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.personAId || !formData.personBId) {
      toast({
        variant: 'destructive',
        title: '验证错误',
        description: '必须选择两个人',
      });
      return;
    }

    if (formData.personAId === formData.personBId) {
      toast({
        variant: 'destructive',
        title: '验证错误',
        description: '不能为同一个人创建关系',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      toast({
        title: mode === 'create' ? '关系已创建' : '关系已更新',
        description: '关系已保存。',
      });
      // Reset form after successful submission in create mode
      if (mode === 'create') {
        setFormData({
          personAId: preselectedPersonA || '',
          personBId: preselectedPersonB || '',
          type: RelType.PARENT_CHILD,
          startYear: null,
          startMonth: null,
          startDay: null,
          endYear: null,
          endMonth: null,
          endDay: null,
        });
      }
      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '错误',
        description: error instanceof Error ? error.message : '保存关系失败',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPersonName = (id: string) => {
    const person = persons.find(p => p.id === id);
    return person ? person.name : '未知';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? '添加新关系' : '编辑关系'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Person A */}
          <div className="space-y-2">
            <Label htmlFor="personA">甲</Label>
            <Select
              value={formData.personAId}
              onValueChange={(value) => handleInputChange('personAId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择第一个人" />
              </SelectTrigger>
              <SelectContent>
                {persons.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Relationship Type */}
          <div className="space-y-2">
            <Label htmlFor="type">关系类型</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => handleInputChange('type', value as RelationshipType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择关系类型" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RELATIONSHIP_LABELS)
                  .filter(([value]) => !HIDDEN_RELATIONSHIP_TYPES.includes(value as RelType))
                  .map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div>
                        <div>{label}</div>
                        <div className="text-xs text-muted-foreground">
                          {RELATIONSHIP_DESCRIPTIONS[value as RelationshipType]}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {formData.type && (
              <p className="text-sm text-muted-foreground">
                {RELATIONSHIP_DESCRIPTIONS[formData.type]}
              </p>
            )}
          </div>

          {/* Person B */}
          <div className="space-y-2">
            <Label htmlFor="personB">乙</Label>
            <Select
              value={formData.personBId}
              onValueChange={(value) => handleInputChange('personBId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择第二个人" />
              </SelectTrigger>
              <SelectContent>
                {persons
                  .filter((p) => p.id !== formData.personAId)
                  .map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label>开始日期（可选）</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder="年"
                value={formData.startYear || ''}
                onChange={(e) => handleInputChange('startYear', e.target.value ? parseInt(e.target.value) : null)}
                min={0}
                max={2100}
              />
              <Input
                type="number"
                placeholder="月"
                value={formData.startMonth || ''}
                onChange={(e) => handleInputChange('startMonth', e.target.value ? parseInt(e.target.value) : null)}
                min={1}
                max={12}
              />
              <Input
                type="number"
                placeholder="日"
                value={formData.startDay || ''}
                onChange={(e) => handleInputChange('startDay', e.target.value ? parseInt(e.target.value) : null)}
                min={1}
                max={31}
              />
            </div>
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label>结束日期（可选）</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder="年"
                value={formData.endYear || ''}
                onChange={(e) => handleInputChange('endYear', e.target.value ? parseInt(e.target.value) : null)}
                min={0}
                max={2100}
              />
              <Input
                type="number"
                placeholder="月"
                value={formData.endMonth || ''}
                onChange={(e) => handleInputChange('endMonth', e.target.value ? parseInt(e.target.value) : null)}
                min={1}
                max={12}
              />
              <Input
                type="number"
                placeholder="日"
                value={formData.endDay || ''}
                onChange={(e) => handleInputChange('endDay', e.target.value ? parseInt(e.target.value) : null)}
                min={1}
                max={31}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
