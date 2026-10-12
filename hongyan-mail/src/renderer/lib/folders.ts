import type { FolderInfo, SpecialUse, UnifiedBox, ViewSpec } from '@shared/types';

export const SPECIAL_NAMES: Record<SpecialUse, string> = {
  inbox: '收件箱',
  sent: '已发送',
  drafts: '草稿箱',
  trash: '已删除',
  junk: '垃圾邮件',
  archive: '归档',
  all: '所有邮件',
  flagged: '星标',
  important: '重要'
};

export const UNIFIED_NAMES: Record<UnifiedBox, string> = {
  inbox: '收件箱',
  starred: '星标邮件',
  unread: '未读邮件',
  sent: '已发送',
  drafts: '草稿箱',
  attachments: '带附件',
  archive: '归档',
  trash: '已删除',
  junk: '垃圾邮件'
};

const SPECIAL_ORDER: Record<string, number> = { inbox: 0, drafts: 1, sent: 2, archive: 3, all: 4, junk: 5, trash: 6 };

export function folderName(f: FolderInfo): string {
  if (f.specialUse && SPECIAL_NAMES[f.specialUse]) return SPECIAL_NAMES[f.specialUse];
  return f.name;
}

export interface FolderNode {
  folder: FolderInfo;
  depth: number;
  children: FolderNode[];
}

/** Specials first (fixed order), then user folders as a tree sorted by name. */
export function folderTree(folders: FolderInfo[]): { specials: FolderInfo[]; tree: FolderNode[] } {
  const specials = folders.filter((f) => f.specialUse).sort((a, b) => (SPECIAL_ORDER[a.specialUse!] ?? 9) - (SPECIAL_ORDER[b.specialUse!] ?? 9));
  const user = folders.filter((f) => !f.specialUse);
  const byPath = new Map(user.map((f) => [f.path, f]));
  const nodes = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];
  for (const f of user) nodes.set(f.path, { folder: f, depth: 0, children: [] });
  for (const f of user) {
    const node = nodes.get(f.path)!;
    let parentPath = f.parentPath;
    if (!parentPath && f.delimiter && f.path.includes(f.delimiter)) parentPath = f.path.slice(0, f.path.lastIndexOf(f.delimiter));
    // INBOX.Sub style hierarchies: hang children of special folders at the top level.
    const parent = parentPath && byPath.has(parentPath) ? nodes.get(parentPath) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (list: FolderNode[], depth: number) => {
    list.sort((a, b) => a.folder.name.localeCompare(b.folder.name, 'zh-CN'));
    for (const n of list) { n.depth = depth; sortRec(n.children, depth + 1); }
  };
  sortRec(roots, 0);
  return { specials, tree: roots };
}

export function flattenTree(nodes: FolderNode[], collapsed: Set<number>): FolderNode[] {
  const out: FolderNode[] = [];
  const walk = (list: FolderNode[]) => {
    for (const n of list) {
      out.push(n);
      if (!collapsed.has(n.folder.id)) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function viewKey(v: ViewSpec): string {
  if (v.kind === 'unified') return `u:${v.box}`;
  if (v.kind === 'folder') return `f:${v.folderId}`;
  return `s:${v.accountId || ''}:${v.query}`;
}

export function sameView(a: ViewSpec, b: ViewSpec): boolean {
  return viewKey(a) === viewKey(b);
}
