// Un seul point d'entrée pour les logs de toute l'app — avant ça, chaque
// fichier appelait console.log/warn/error directement, avec des formats
// différents et aucun moyen de savoir d'où vient une ligne en lisant les
// logs de prod. `getLogger(tag)` donne un logger scopé (préfixe [tag],
// niveaux colorés) — consola s'occupe du formatage, rien à configurer.
import { consola } from "consola";

export function getLogger(tag: string) {
  return consola.withTag(tag);
}
