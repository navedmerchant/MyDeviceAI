export interface SearchLink {
    title: string;
    url: string;
    thumbnail?: string;
}

export interface Message {
    id: number;
    text: string;
    isUser: boolean;
    thumbnails?: string[];
    searchLinks?: SearchLink[];
    images?: string[];
}
  