export interface Folder {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  isSystem?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface FolderCreateInput {
  name: string;
  description?: string;
  icon?: string;
}

export interface FolderUpdateInput {
  id: string;
  name?: string;
  description?: string;
  icon?: string;
}
