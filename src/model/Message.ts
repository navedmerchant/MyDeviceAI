export interface Message {
    id: number;
    text: string;
    isUser: boolean;
    thumbnails?: string[];
}
  