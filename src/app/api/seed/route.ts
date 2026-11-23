import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { addRecords, hasPersons } from '@/lib/family-service';
import type { StoredPerson } from '@/lib/store';
import type { Person, Relationship, ApiResponse } from '@/types';
import { shouldSwapPartners } from '@/lib/relationship-direction';
import { Gender, RelationshipType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Sample data based on "A Dream in Red Mansions" (Jia Family)
const JIA_FAMILY_MEMBERS: Partial<Person>[] = [
  // Generation -1 (Grandparents)
  { name: '贾代善', gender: Gender.MALE, birthYear: 1650, deathYear: 1710 },
  { name: '贾母', gender: Gender.FEMALE, birthYear: 1655, deathYear: 1720 },

  // Generation 0 (Parents)
  { name: '贾赦', gender: Gender.MALE, birthYear: 1680, deathYear: 1740 },
  { name: '贾政', gender: Gender.MALE, birthYear: 1685, deathYear: 1750, courtesyName: '存忠' },
  { name: '王夫人', gender: Gender.FEMALE, birthYear: 1688, deathYear: 1755 },
  { name: '邢夫人', gender: Gender.FEMALE, birthYear: 1685, deathYear: 1745 },

  // Generation +1 (Children)
  { name: '贾琏', gender: Gender.MALE, birthYear: 1710, deathYear: 1770 },
  { name: '贾珠', gender: Gender.MALE, birthYear: 1712, deathYear: 1730 },
  { name: '贾宝玉', gender: Gender.MALE, birthYear: 1715, courtesyName: '宝玉', artName: '通灵' },
  { name: '贾元春', gender: Gender.FEMALE, birthYear: 1710, deathYear: 1760 },
  { name: '贾迎春', gender: Gender.FEMALE, birthYear: 1718, deathYear: 1765 },
  { name: '贾惜春', gender: Gender.FEMALE, birthYear: 1720, deathYear: 1770 },
  { name: '贾探春', gender: Gender.FEMALE, birthYear: 1717, deathYear: 1768 },
  { name: '王熙凤', gender: Gender.FEMALE, birthYear: 1712, deathYear: 1765 },
  { name: '李纨', gender: Gender.FEMALE, birthYear: 1714, deathYear: 1775 },

  // Generation +2 (Grandchildren)
  { name: '贾兰', gender: Gender.MALE, birthYear: 1730, deathYear: 1790 },
  { name: '贾巧姐', gender: Gender.FEMALE, birthYear: 1740 },
];

// POST /api/seed - Seed the database with sample data
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if data already exists
    if (await hasPersons()) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Database already contains data. Clear it first.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const userId = session.user.id;

    // Create persons
    const personIdMap = new Map<string, string>();
    const persons: StoredPerson[] = [];

    for (const member of JIA_FAMILY_MEMBERS) {
      const id = uuidv4();
      personIdMap.set(member.name!, id);

      const person: StoredPerson = {
        id,
        name: member.name!,
        courtesyName: member.courtesyName,
        artName: member.artName,
        gender: member.gender!,
        birthYear: member.birthYear ?? null,
        birthMonth: member.birthMonth ?? null,
        birthDay: member.birthDay ?? null,
        deathYear: member.deathYear ?? null,
        deathMonth: member.deathMonth ?? null,
        deathDay: member.deathDay ?? null,
        avatarVersion: null,
        isPrivate: false,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      persons.push(person);
    }

    // Create relationships
    const relationships: Relationship[] = [];

    // One record per relationship; spouse and concubine with the woman as person A
    const genderOf = new Map(persons.map((p) => [p.id, p.gender]));
    const createRel = (nameA: string, nameB: string, type: RelationshipType) => {
      let idA = personIdMap.get(nameA);
      let idB = personIdMap.get(nameB);
      if (idA && idB) {
        if (shouldSwapPartners(type, genderOf.get(idA), genderOf.get(idB))) [idA, idB] = [idB, idA];
        const rel: Relationship = {
          id: uuidv4(),
          personAId: idA,
          personBId: idB,
          type,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        };
        relationships.push(rel);
      }
    };

    // Parent-child relationships
    createRel('贾代善', '贾赦', RelationshipType.PARENT_CHILD);
    createRel('贾代善', '贾政', RelationshipType.PARENT_CHILD);
    createRel('贾母', '贾赦', RelationshipType.PARENT_CHILD);
    createRel('贾母', '贾政', RelationshipType.PARENT_CHILD);
    createRel('贾赦', '贾琏', RelationshipType.PARENT_CHILD);
    createRel('贾赦', '贾迎春', RelationshipType.PARENT_CHILD);
    createRel('贾政', '贾珠', RelationshipType.PARENT_CHILD);
    createRel('贾政', '贾宝玉', RelationshipType.PARENT_CHILD);
    createRel('贾政', '贾元春', RelationshipType.PARENT_CHILD);
    createRel('贾政', '贾探春', RelationshipType.PARENT_CHILD);
    createRel('贾政', '贾惜春', RelationshipType.PARENT_CHILD);
    createRel('王夫人', '贾珠', RelationshipType.PARENT_CHILD);
    createRel('王夫人', '贾宝玉', RelationshipType.PARENT_CHILD);
    createRel('王夫人', '贾元春', RelationshipType.PARENT_CHILD);
    createRel('贾珠', '贾兰', RelationshipType.PARENT_CHILD);
    createRel('李纨', '贾兰', RelationshipType.PARENT_CHILD);
    createRel('贾琏', '贾巧姐', RelationshipType.PARENT_CHILD);
    createRel('王熙凤', '贾巧姐', RelationshipType.PARENT_CHILD);
    // Spouse relationships
    createRel('贾代善', '贾母', RelationshipType.SPOUSE);
    createRel('贾赦', '邢夫人', RelationshipType.SPOUSE);
    createRel('贾政', '王夫人', RelationshipType.SPOUSE);
    createRel('贾琏', '王熙凤', RelationshipType.SPOUSE);
    createRel('贾珠', '李纨', RelationshipType.SPOUSE);

    await addRecords(persons, relationships);

    return NextResponse.json<ApiResponse<{ persons: number; relationships: number }>>({
      success: true,
      data: {
        persons: persons.length,
        relationships: relationships.length,
      },
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Failed to seed database' },
      { status: 500 }
    );
  }
}
