import { describe, expect, it } from "vitest";
import {
  parseVercelDeployment,
  parseVercelDeploymentAliases,
  parseVercelDeployments,
  parseVercelDomainConfig,
  parseVercelEnvVar,
  parseVercelEnvVars,
  parseVercelProject,
  parseVercelProjectDomain,
  parseVercelProjectDomains,
  parseVercelProjects,
  parseVercelTeam,
  parseVercelTeams,
  parseVercelUser,
} from "./parsers.js";

describe("Vercel response parsers", () => {
  it("parseVercelUser acepta respuesta envuelta en user", () => {
    const user = parseVercelUser({
      user: {
        id: "u1",
        email: "test@example.com",
        username: "tester",
      },
    });

    expect(user).toEqual({
      id: "u1",
      email: "test@example.com",
      username: "tester",
    });
  });

  it("parseVercelUser acepta usuario plano", () => {
    const user = parseVercelUser({
      id: "u2",
      email: "plain@example.com",
    });

    expect(user.id).toBe("u2");
  });

  it("parseVercelTeams acepta lista paginada", () => {
    const teams = parseVercelTeams({
      teams: [{ id: "team_1", slug: "acme", name: "Acme" }],
      pagination: { count: 1, next: null, prev: null },
    });

    expect(teams).toHaveLength(1);
    expect(teams[0]?.slug).toBe("acme");
  });

  it("parseVercelTeams acepta team único cuando hay slug en query", () => {
    const teams = parseVercelTeams({
      id: "team_1",
      slug: "compramelafotos-projects",
      name: "compramelafoto's projects",
      membership: { role: "OWNER", confirmed: true },
    });

    expect(teams).toHaveLength(1);
    expect(teams[0]?.id).toBe("team_1");
  });

  it("parseVercelTeam acepta team envuelto", () => {
    const team = parseVercelTeam({
      team: { id: "team_2", slug: "dnx" },
    });

    expect(team.slug).toBe("dnx");
  });

  it("parseVercelProjects y parseVercelProject", () => {
    const projects = parseVercelProjects({
      projects: [{ id: "prj_1", name: "compramelafoto", framework: "nextjs" }],
      pagination: { count: 1, next: null, prev: null },
    });

    expect(projects[0]?.name).toBe("compramelafoto");

    const project = parseVercelProject({
      project: { id: "prj_1", name: "wrapped" },
    });

    expect(project.name).toBe("wrapped");
  });

  it("parseVercelDeployments y parseVercelDeployment", () => {
    const deployments = parseVercelDeployments({
      deployments: [{ id: "dpl_1", readyState: "READY", url: "app.vercel.app" }],
    });

    expect(deployments[0]?.id).toBe("dpl_1");

    const deployment = parseVercelDeployment({
      deployment: { id: "dpl_2", readyState: "BUILDING" },
    });

    expect(deployment.id).toBe("dpl_2");
  });

  it("parseVercelEnvVars ignora campos extra del listado", () => {
    const envs = parseVercelEnvVars({
      envs: [{ id: "env_1", key: "DATABASE_URL", target: ["production"] }],
      hiddenProductionEnvCount: 3,
    });

    expect(envs).toHaveLength(1);
    expect(envs[0]?.key).toBe("DATABASE_URL");
  });

  it("parseVercelEnvVar acepta env envuelto", () => {
    const env = parseVercelEnvVar({
      env: { id: "env_2", key: "API_URL", target: ["preview"] },
    });

    expect(env.key).toBe("API_URL");
  });

  it("parseVercelProjectDomains y parseVercelProjectDomain", () => {
    const domains = parseVercelProjectDomains({
      domains: [{ name: "app.example.com", verified: true }],
    });

    expect(domains[0]?.name).toBe("app.example.com");

    const domain = parseVercelProjectDomain({
      domain: { name: "wrapped.example.com", verified: false },
    });

    expect(domain.name).toBe("wrapped.example.com");
  });

  it("parseVercelDomainConfig tolera campos DNS extra", () => {
    const config = parseVercelDomainConfig({
      configuredBy: "CNAME",
      misconfigured: false,
      acceptedChallenges: ["dns-01"],
      nameservers: ["ns1.vercel-dns.com"],
      cnames: ["cname.vercel-dns.com"],
    });

    expect(config).toEqual({
      configuredBy: "CNAME",
      misconfigured: false,
      acceptedChallenges: ["dns-01"],
    });
  });

  it("parseVercelDeploymentAliases acepta aliases como objetos", () => {
    const aliases = parseVercelDeploymentAliases({
      aliases: [
        { uid: "abc", alias: "www.example.com" },
        { uid: "def", alias: "example.com" },
      ],
    });

    expect(aliases).toEqual(["www.example.com", "example.com"]);
  });

  it("parseVercelDeploymentAliases acepta alias como string[] legacy", () => {
    const aliases = parseVercelDeploymentAliases({
      alias: ["legacy.example.com"],
    });

    expect(aliases).toEqual(["legacy.example.com"]);
  });
});
