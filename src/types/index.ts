export type MarkerType = 'message' | 'group';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface CreatePostData {
  type: MarkerType;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  allowAnyoneToPost?: boolean;
  allowComments?: boolean;
}
