// Vérifie qu'un tirage a bien été fait aujourd'hui, et le déclenche sinon —
// appelé au démarrage du serveur, systématiquement (pas seulement quand le
// fichier de cache est absent). Avant, le garde-fou ne vérifiait que
// `!fs.existsSync(fichier)` : un fichier périmé laissé par un cron en échec
// (voir retry-with-alert.ts, incident du 02/09/2026) passait inaperçu,
// puisque le fichier existait bel et bien — juste avec les données de la
// veille. La vraie question est "y a-t-il une entrée du jour ?", pas
// "le fichier existe-t-il ?".
import fs from "fs/promises";
import { getLogger } from "./logger";

export async function ensureDailyDraw(options: {
  label: string;
  fileName: string;
  // Doit renvoyer l'entrée d'aujourd'hui si elle existe déjà (peu importe la
  // source — archive ou, pour AstroBin, le fichier de cache lui-même), ou
  // null sinon.
  getTodaysEntry: () => Promise<any | null>;
  // Tire un nouvel élément et écrit le fichier de cache lui-même (voir
  // writeAnimalJSON etc.) — jamais appelé si getTodaysEntry a déjà trouvé
  // quelque chose.
  draw: () => Promise<void>;
}): Promise<void> {
  const log = getLogger(options.label);

  const todaysEntry = await options.getTodaysEntry();
  if (todaysEntry) {
    // Réécrit systématiquement (même si le fichier semblait déjà correct) —
    // c'est une opération idempotente et bon marché, qui rattrape aussi le
    // cas où le fichier avait disparu alors que l'archive, elle, était bonne.
    await fs.writeFile(options.fileName, JSON.stringify(todaysEntry, null, 2));
    log.info("Today's draw already exists — cache file is up to date.");
    return;
  }

  log.info("No draw found for today — drawing now.");
  await options.draw();
}
