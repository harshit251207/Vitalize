import { DisabilityCategories, DisabilityCategory } from '@/services/aiService';

export type DisabilityCategoryId = Exclude<DisabilityCategory, 'unclear'>;

export type NoticeBoardCard = {
  id: DisabilityCategoryId;
  title: string;
  description: string;
  pinColor: string;
};

export const NOTICE_BOARD_CARDS: NoticeBoardCard[] = [
  {
    id: 'Hemiplegia',
    title: 'Hemiplegia',
    description: 'One side of the body is affected.',
    pinColor: '#F87171',
  },
  {
    id: 'Paraplegia',
    title: 'Paraplegia',
    description: 'Both legs / lower body are affected.',
    pinColor: '#38BDF8',
  },
  {
    id: 'Quadriplegia/Tetraplegia',
    title: 'Quadriplegia (Tetraplegia)',
    description: 'All four limbs are affected.',
    pinColor: '#FBBF24',
  },
  {
    id: 'Monoplegia',
    title: 'Monoplegia',
    description: 'A single limb is affected.',
    pinColor: '#34D399',
  },
  {
    id: 'Diplegia',
    title: 'Diplegia',
    description: 'Both arms or both legs are affected, often equally.',
    pinColor: '#A78BFA',
  },
];

export { DisabilityCategories };
export type { DisabilityCategory };
