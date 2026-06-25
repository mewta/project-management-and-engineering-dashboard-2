export type CommandSearchResponse = {
  issues: {
    id: string;
    key: string;
    title: string;
    status: string;
    projectId: string;
  }[];
  projects: {
    id: string;
    name: string;
    orgId: string;
  }[];
  members: {
    id: string;
    name: string;
    avatarUrl: string | null;
  }[];
};

export async function searchCommandData({
  query,
  scope,
  projectId,
}: {
  query: string;
  scope: "issues" | "projects" | "members" | "all";
  projectId?: string;
}) {
  const searchParams = new URLSearchParams({
    q: query,
    scope,
  });

  if (projectId) {
    searchParams.set("projectId", projectId);
  }

  const response = await fetch(`/api/search?${searchParams.toString()}`);
  if (!response.ok) {
    return {
      issues: [],
      projects: [],
      members: [],
    } satisfies CommandSearchResponse;
  }

  return (await response.json()) as CommandSearchResponse;
}

export function stripCommandTerms(query: string, terms: string[]) {
  const ignoredTerms = new Set(terms.map((term) => term.toLowerCase()));

  return query
    .split(/\s+/)
    .filter((term) => !ignoredTerms.has(term.toLowerCase()))
    .join(" ")
    .trim();
}
