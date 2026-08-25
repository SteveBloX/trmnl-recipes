// Agrège 3 endpoints de l'API Dokploy (auto-hébergée) en un payload compact
// pour le plugin TRMNL : liste des services, gauges mémoire/disque de l'hôte
// (stats "dokploy" du monitoring intégré), et les derniers déploiements.
//
// Doc API : https://docs.dokploy.com/docs/api (auth via header x-api-key)

const DOKPLOY_URL = (process.env.DOKPLOY_URL || "").replace(/\/+$/, "");
const DOKPLOY_API_KEY = process.env.DOKPLOY_API_KEY || "";

type DokployService = {
  name: string;
  type: "application" | "compose";
  status: string;
  project: string;
};

type DokployMemory = { used_gb: number; total_gb: number; percent: number };
type DokployDisk = {
  used_gb: number;
  total_gb: number;
  free_gb: number;
  percent: number;
};
type DokployDeployment = {
  target: string;
  project: string | null;
  status: string;
  created_at: string | null;
  finished_at: string | null;
};

async function dokployFetch(path: string): Promise<any> {
  const res = await fetch(`${DOKPLOY_URL}/api/${path}`, {
    headers: { "x-api-key": DOKPLOY_API_KEY },
  });
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// "1.23GiB" / "512.00MiB" -> nombre de GiB
function parseSizeToGiB(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const match = raw.match(/([\d.]+)\s*(GiB|MiB|KiB|B)/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  switch (match[2].toLowerCase()) {
    case "gib":
      return value;
    case "mib":
      return value / 1024;
    case "kib":
      return value / 1024 / 1024;
    default:
      return value / 1024 / 1024 / 1024;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function extractServices(projects: any[]): DokployService[] {
  const services: DokployService[] = [];
  for (const project of projects ?? []) {
    for (const env of project.environments ?? []) {
      for (const app of env.applications ?? []) {
        services.push({
          name: app.name,
          type: "application",
          status: app.applicationStatus,
          project: project.name,
        });
      }
      for (const c of env.compose ?? []) {
        services.push({
          name: c.name,
          type: "compose",
          status: c.composeStatus,
          project: project.name,
        });
      }
    }
  }
  return services;
}

// Les stats "dokploy" (hôte) sont un historique de points {value, time} ;
// on ne garde que le dernier point pour les gauges.
function extractMemory(monitoring: any): DokployMemory | null {
  const points = monitoring?.memory;
  const last = Array.isArray(points) ? points[points.length - 1] : null;
  const usedGiB = parseSizeToGiB(last?.value?.used);
  const totalGiB = parseSizeToGiB(last?.value?.total);
  if (usedGiB === null || !totalGiB) return null;
  return {
    used_gb: round1(usedGiB),
    total_gb: round1(totalGiB),
    percent: Math.round((usedGiB / totalGiB) * 100),
  };
}

function extractDisk(monitoring: any): DokployDisk | null {
  const points = monitoring?.disk;
  const last = Array.isArray(points) ? points[points.length - 1] : null;
  const v = last?.value;
  if (!v || typeof v.diskTotal !== "number") return null;
  return {
    used_gb: round1(v.diskUsage),
    total_gb: round1(v.diskTotal),
    free_gb: round1(v.diskFree),
    percent: Math.round(v.diskUsedPercentage),
  };
}

function extractDeployments(deployments: any[]): DokployDeployment[] {
  return (deployments ?? []).slice(0, 3).map((d) => ({
    target: d.application?.name || d.compose?.name || "—",
    project:
      d.application?.environment?.project?.name ||
      d.compose?.environment?.project?.name ||
      null,
    status: d.status,
    created_at: d.createdAt ?? null,
    finished_at: d.finishedAt ?? null,
  }));
}

export async function dokployRequest(_query: unknown, _body: unknown = null) {
  if (!DOKPLOY_URL || !DOKPLOY_API_KEY) {
    return { error: "DOKPLOY_URL / DOKPLOY_API_KEY is not configured" };
  }

  try {
    const [projects, monitoring, deployments] = await Promise.all([
      dokployFetch("project.all"),
      // Stats de l'hôte (CPU/mémoire/disque) : appName="dokploy" est le cas
      // spécial documenté dans le monitoring intégré pour cibler l'hôte
      // plutôt qu'un conteneur applicatif.
      dokployFetch("application.readAppMonitoring?appName=dokploy"),
      dokployFetch("deployment.allCentralized"),
    ]);

    return {
      services: extractServices(projects),
      memory: extractMemory(monitoring),
      disk: extractDisk(monitoring),
      deployments: extractDeployments(deployments),
    };
  } catch (e: any) {
    return { error: String(e.message) };
  }
}
