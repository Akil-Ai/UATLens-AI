const API_BASE = "/api";

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchSampleDocument() {
  const res = await fetch(`${API_BASE}/sample`);
  if (!res.ok) throw new Error("Failed to load sample document.");
  return res.json();
}

export async function fetchProjects() {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error("Failed to load projects list.");
  return res.json();
}

export async function fetchProject(id: string) {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) throw new Error("Failed to load project.");
  return res.json();
}

export async function createProject(name: string, raw_text: string) {
  const res = await fetch(`${API_BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, raw_text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create project.");
  }
  return res.json();
}

export async function updateProject(id: string, updates: { name?: string; raw_text?: string }) {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update project.");
  return res.json();
}

export async function deleteProject(id: string) {
  const res = await fetch(`${API_BASE}/projects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete project.");
  return res.json();
}

export async function parseUploadedDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/parse`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to parse document.");
  }
  return res.json();
}

export async function extractContext(projectId: string, text?: string) {
  const res = await fetch(`${API_BASE}/extract-context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to extract context.");
  }
  return res.json();
}

export async function fetchContext(projectId: string) {
  const res = await fetch(`${API_BASE}/context/${projectId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function updateContext(projectId: string, contextData: any) {
  const res = await fetch(`${API_BASE}/context/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context: contextData }),
  });
  if (!res.ok) throw new Error("Failed to save updated context.");
  return res.json();
}

export async function fetchTestCases(projectId: string, filters?: Record<string, string>) {
  const params = new URLSearchParams({ project_id: projectId, ...(filters || {}) });
  const res = await fetch(`${API_BASE}/test-cases?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load test cases.");
  return res.json();
}

export async function updateTestCase(testCaseId: string, projectId: string, payload: any) {
  const res = await fetch(`${API_BASE}/test-cases/${testCaseId}?project_id=${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update test case.");
  return res.json();
}

export async function undoTestCase(testCaseId: string, projectId: string) {
  const res = await fetch(`${API_BASE}/test-cases/${testCaseId}/undo?project_id=${projectId}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("No earlier versions to undo.");
  return res.json();
}

export async function regenerateField(projectId: string, testCaseId: string, targetField: string, instruction?: string) {
  const res = await fetch(`${API_BASE}/regenerate-field`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      test_case_id: testCaseId,
      target_field: targetField,
      instruction: instruction || "",
    }),
  });
  if (!res.ok) throw new Error("Failed to regenerate field.");
  return res.json();
}

export async function bulkUpdateTestCases(projectId: string, testCaseIds: string[], action: string, value?: string) {
  const res = await fetch(`${API_BASE}/test-cases/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, test_case_ids: testCaseIds, action, value }),
  });
  if (!res.ok) throw new Error("Failed to perform bulk action.");
  return res.json();
}

export async function deleteTestCase(testCaseId: string, projectId: string) {
  const res = await fetch(`${API_BASE}/test-cases/${testCaseId}?project_id=${projectId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete test case.");
  return res.json();
}

export async function validateSuite(projectId: string) {
  const res = await fetch(`${API_BASE}/validate-suite?project_id=${projectId}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to validate test suite.");
  return res.json();
}

# Commit ref: 56
