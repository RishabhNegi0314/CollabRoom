import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { CollabState, ProjectFile, KanbanTask, CanvasElement, GitState } from "../types.js";

/**
 * Service to persist and synchronize workspace states in Firestore
 * conforming to firebase-blueprint.json (workspaces/{workspaceId}).
 */

export async function saveWorkspaceToFirestore(workspaceId: string, state: CollabState): Promise<boolean> {
  if (!workspaceId) return false;
  // Ensure sanitized workspace ID matching firestore.rules regex: '^[a-zA-Z0-9_\-]+$'
  const cleanId = workspaceId.replace(/[^a-zA-Z0-9_\-]/g, "_");

  try {
    const payload = {
      files: (state.files || []).map((f: ProjectFile) => ({
        id: f.id,
        name: f.name,
        path: f.path || f.name,
        language: f.language,
        content: f.content
      })),
      users: (state.users || []).map((u) => ({
        id: u.id,
        name: u.name,
        color: u.color,
        isMuted: !!u.isMuted,
        isSpeaking: !!u.isSpeaking,
        activeFileId: u.activeFileId || null,
        cursorIndex: typeof u.cursorIndex === "number" ? u.cursorIndex : null
      })),
      git: state.git || {
        currentBranch: "main",
        branches: ["main"],
        commits: [],
        stagedFiles: []
      },
      tasks: (state.tasks || []).map((t: KanbanTask) => ({
        id: t.id,
        title: t.title,
        description: t.description || "",
        status: t.status,
        assignee: t.assignee || "Unassigned",
        priority: t.priority || "medium",
        points: t.points || 1
      })),
      canvasElements: (state.canvasElements || []).map((c: CanvasElement) => ({
        id: c.id,
        type: c.type,
        x: c.x,
        y: c.y,
        text: c.text || "",
        width: c.width || 100,
        height: c.height || 100,
        color: c.color || "#ffffff",
        bgColor: c.bgColor || "#18181b",
        borderColor: c.borderColor || "#27272a",
        borderRadius: c.borderRadius || "0.5rem"
      }))
    };

    await setDoc(doc(db, "workspaces", cleanId), payload, { merge: true });
    return true;
  } catch (err) {
    console.warn("Failed to persist workspace to Firestore:", err);
    return false;
  }
}

export async function loadWorkspaceFromFirestore(workspaceId: string): Promise<CollabState | null> {
  if (!workspaceId) return null;
  const cleanId = workspaceId.replace(/[^a-zA-Z0-9_\-]/g, "_");

  try {
    const snap = await getDoc(doc(db, "workspaces", cleanId));
    if (snap.exists()) {
      const data = snap.data();
      return {
        files: (data.files || []) as ProjectFile[],
        users: data.users || [],
        git: (data.git || { currentBranch: "main", branches: ["main"], commits: [], stagedFiles: [] }) as GitState,
        tasks: (data.tasks || []) as KanbanTask[],
        canvasElements: (data.canvasElements || []) as CanvasElement[]
      };
    }
    return null;
  } catch (err) {
    console.warn("Error loading workspace from Firestore:", err);
    return null;
  }
}

export function subscribeToFirestoreWorkspace(
  workspaceId: string,
  onUpdate: (state: CollabState) => void
): () => void {
  if (!workspaceId) return () => {};
  const cleanId = workspaceId.replace(/[^a-zA-Z0-9_\-]/g, "_");

  try {
    const unsub = onSnapshot(doc(db, "workspaces", cleanId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onUpdate({
          files: (data.files || []) as ProjectFile[],
          users: data.users || [],
          git: (data.git || { currentBranch: "main", branches: ["main"], commits: [], stagedFiles: [] }) as GitState,
          tasks: (data.tasks || []) as KanbanTask[],
          canvasElements: (data.canvasElements || []) as CanvasElement[]
        });
      }
    }, (err) => {
      console.warn("Firestore subscription error:", err);
    });
    return unsub;
  } catch (err) {
    console.warn("Failed to setup Firestore subscription:", err);
    return () => {};
  }
}
