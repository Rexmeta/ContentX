import type {
  Organization,
  Project,
  Member,
  UserRole,
} from "@workspace/simulation-contract";

export class OrganizationService {
  private orgs: Map<string, Organization> = new Map();
  private projects: Map<string, Project> = new Map();
  private members: Map<string, Member> = new Map();

  createOrganization(input: { id?: string; name: string; slug: string; plan?: Organization["plan"] }): Organization {
    const id = input.id ?? `org_${Date.now()}`;
    const org: Organization = {
      id,
      name: input.name,
      slug: input.slug,
      plan: input.plan ?? "enterprise",
      createdAt: new Date().toISOString(),
    };
    this.orgs.set(org.id, org);
    return org;
  }

  getOrganization(id: string): Organization | undefined {
    return this.orgs.get(id);
  }

  listOrganizations(): Organization[] {
    return Array.from(this.orgs.values());
  }

  createProject(input: { id?: string; organizationId: string; name: string; description?: string }): Project {
    const org = this.orgs.get(input.organizationId);
    if (!org) {
      throw new Error(`Organization "${input.organizationId}" not found`);
    }

    const id = input.id ?? `proj_${Date.now()}`;
    const project: Project = {
      id,
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
      createdAt: new Date().toISOString(),
    };
    this.projects.set(project.id, project);
    return project;
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  listProjects(organizationId?: string): Project[] {
    const all = Array.from(this.projects.values());
    if (organizationId) {
      return all.filter((p) => p.organizationId === organizationId);
    }
    return all;
  }

  addMember(input: { organizationId: string; email: string; name: string; role?: UserRole }): Member {
    const id = `mem_${Date.now()}`;
    const member: Member = {
      id,
      organizationId: input.organizationId,
      email: input.email,
      name: input.name,
      role: input.role ?? "engineer",
      createdAt: new Date().toISOString(),
    };
    this.members.set(member.id, member);
    return member;
  }

  listMembers(organizationId: string): Member[] {
    return Array.from(this.members.values()).filter((m) => m.organizationId === organizationId);
  }

  hasPermission(role: UserRole, action: "manage_org" | "manage_agents" | "run_benchmarks" | "view_results"): boolean {
    const permissions: Record<UserRole, string[]> = {
      owner: ["manage_org", "manage_agents", "run_benchmarks", "view_results"],
      admin: ["manage_agents", "run_benchmarks", "view_results"],
      engineer: ["manage_agents", "run_benchmarks", "view_results"],
      analyst: ["view_results"],
      viewer: ["view_results"],
    };
    return permissions[role]?.includes(action) ?? false;
  }
}

export const organizationService = new OrganizationService();
