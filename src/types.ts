export type ItemType = "meal" | "med" | "vet" | "memory" | "milestone" | "expense";
export type FeedItem = { 
  id: string; 
  type: ItemType; 
  title: string; 
  note?: string; 
  ts: number; 
  image?: string;
  receipt?: {
    type: 'image' | 'pdf';
    url: string;
    name: string;
  };
};

